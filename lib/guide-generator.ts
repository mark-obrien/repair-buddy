import { generateText, tool } from 'ai';
import { z } from 'zod';
import { getModel } from './providers';
import type { RepairGuide } from './types';

// ---------------------------------------------------------------------------
// Zod schema — single source of truth for the structured output
// ---------------------------------------------------------------------------
const repairGuideSchema = z.object({
  category: z
    .enum(['auto', 'home', 'appliance', 'electronics', 'outdoor', 'other'])
    .catch('other')
    .describe(
      'Repair domain detected from the video content. auto=cars/trucks/motorcycles. home=plumbing/electrical/HVAC/carpentry/structural. appliance=dishwashers/washers/dryers/refrigerators/ovens. electronics=phones/computers/TVs/circuit boards. outdoor=lawn equipment/generators/power tools/bicycles. other=anything not covered above.'
    ),

  vehicleInfo: z.object({
    applicability: z.string().catch('Universal / General repair').describe('Human-readable summary: e.g. "2018-2022 Toyota Camry" or "Universal / most vehicles"'),
    make: z.string().optional().catch(undefined),
    model: z.string().optional().catch(undefined),
    yearRange: z.string().optional().catch(undefined).describe('e.g. "2018-2022" or "2020"'),
    trim: z.string().optional().catch(undefined).describe('e.g. "All trims" or "LE, SE, XSE"'),
    notes: z.string().optional().catch(undefined).describe('Additional compatibility info, e.g. platform mates or model variants'),
    isGeneral: z.boolean().catch(false).describe('true when no specific vehicle/appliance is identified'),
  }).catch({ applicability: 'Universal / General repair', isGeneral: true }),

  summary: z.string().catch('No summary provided.').describe('2-4 sentence summary of what repair is covered and the overall approach'),

  difficulty: z
    .enum(['beginner', 'intermediate', 'advanced', 'expert'])
    .optional()
    .catch('intermediate' as any)
    .describe(
      'Estimated DIY difficulty relative to the repair domain. beginner=any motivated person with basic tools. intermediate=requires relevant aptitude and a modest toolkit. advanced=specialty tools, domain knowledge, or meaningful consequence of error. expert=licensed trade level or high safety risk.'
    ),

  difficultyReason: z
    .string()
    .optional()
    .catch(undefined)
    .describe('One sentence explaining the difficulty rating — what makes this job easy or hard.'),

  estimatedTimeMinutes: z
    .number()
    .optional()
    .catch(undefined)
    .describe('Estimated total time in minutes for an attentive DIYer. Round to a sensible number. If the video states a time, prefer that; otherwise use repair knowledge.'),

  partsNeeded: z.array(z.object({
    name: z.string().catch('Unnamed part'),
    partNumber: z.string().optional().catch(undefined).describe('OEM or aftermarket part number only if explicitly stated'),
    quantity: z.number().optional().catch(undefined),
    notes: z.string().optional().catch(undefined).describe('Brand recommendations, fitment notes, fluid spec, etc.'),
  })).catch([]),

  standardTools: z.array(z.object({
    name: z.string().catch('Unnamed tool'),
    size: z.string().optional().catch(undefined).describe('Socket size, wrench size, bit size, etc.'),
    notes: z.string().optional().catch(undefined),
  })).catch([]),

  specialtyTools: z.array(z.object({
    name: z.string().catch('Unnamed specialty tool'),
    purpose: z.string().catch('Unknown purpose'),
    altMethod: z.string().optional().catch(undefined).describe('Alternative DIY method if specialty tool unavailable'),
  })).catch([]),

  torqueValues: z.array(z.object({
    component: z.string().catch('Unnamed component'),
    value: z.string().catch(''),
    unit: z.string().catch(''),
    notes: z.string().optional().catch(undefined).describe('Stage torque, angle tightening, sequence info, etc.'),
  })).catch([]),

  repairSteps: z.array(z.object({
    step: z.number().catch(1),
    title: z.string().catch('Repair Step').describe('Short title for this step (5-10 words)'),
    description: z.string().catch('Follow video instructions.'),
    warnings: z.array(z.string()).optional().catch([]),
    timestamp: z.string().optional().catch(undefined).describe('The exact [MM:SS] timestamp marker from the transcript where this step begins. E.g., "04:15" or "12:30". Do NOT calculate seconds.'),
    frameIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .catch(undefined)
      .describe('Index (0-based) into the provided frames array for the frame that best illustrates this step. Only set this if a frame clearly shows the step in question.'),
  })).catch([]),

  warnings: z.array(z.string()).catch([]).describe('Global warnings and cautions that apply to the entire job'),

  diagram: z.string().catch('').describe(
    "Valid Mermaid flowchart TD syntax. First line must be 'flowchart TD'. Short labels only."
  ),

  partsDiagram: z.string().optional().catch(undefined).describe(
    'Complete self-contained SVG schematic. Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">. White background rect first. Title at top. Components in center region. Legend box bottom-right. No scripts, no external refs.'
  ),

  frameAnnotations: z.array(z.object({
    frameIndex: z.number(),
    parts: z.array(z.object({
      label: z.string(),
      x: z.number().describe('Percentage (0-100) from left edge'),
      y: z.number().describe('Percentage (0-100) from top edge'),
    }))
  })).catch([]).describe('Bounding box coordinates to overlay part labels on video frames.'),
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an expert repair technician with 20+ years of hands-on experience across automotive, home improvement, appliances, electronics, outdoor equipment, and general DIY repair. You specialize in analyzing repair video transcripts and extracting precise, actionable information for DIY guides.

CATEGORY: First, classify the repair domain from the video content and set the category field accordingly. Use the descriptions in the schema to pick the best match.

When research context is provided, use it as authoritative background knowledge. Cross-reference it against the video transcript and frames. If the video contradicts the research on a factual point, prefer the video's explicit value but note the discrepancy.

When viewer comments are provided, treat them as field-test feedback. They often catch errors, mention compatibility variations, or warn about gotchas the presenter missed. Incorporate the most-upvoted, relevant comments as warnings or step notes — but never invent part numbers or torque values from comments alone.

SUBJECT INFO: Identify the specific item this repair applies to. Populate vehicleInfo.applicability with a concise human-readable summary (e.g. "2018-2022 Toyota Camry", "Moen 1225 kitchen faucet", "iPhone 14 Pro display assembly", "Carrier 24ACC636A003 AC unit"). Use make/model/yearRange/trim when applicable. Set isGeneral=true only when no specific subject is identifiable.

DIFFICULTY: Rate the job relative to its domain. beginner=any motivated person with basic tools. intermediate=requires relevant aptitude and a modest toolkit. advanced=specialty tools, domain knowledge, or meaningful consequence of error. expert=licensed-trade level or high safety risk. Be honest.

ESTIMATED TIME: Estimate total active time in minutes for an attentive DIYer at a normal pace. Exclude curing/drying/cooling time unless it dominates. Prefer the video's stated time.

PARTS: Extract every part mentioned — part numbers, quantities, brand recommendations. Only include part numbers if explicitly stated verbally.

STANDARD TOOLS: Extract all common tools with sizes/specifications where given.

SPECIALTY TOOLS: Identify non-standard tools. Always note purpose and any DIY alternative.

TORQUE VALUES: Extract every torque specification precisely as stated — never round or estimate.

REPAIR STEPS: Extract 8-20 logical, actionable steps in the exact order performed. For each step:
- Write the description in second person ("Remove the...", "Apply...") with enough detail to execute without watching the video.
- Include specific measurements, socket sizes, torque values, and directional cues (clockwise/counterclockwise, left-to-right, etc.) wherever mentioned.
- If the presenter warns about a common mistake or gotcha mid-step, capture it as a step-level warning.
- Timestamp: find the [MM:SS] marker that immediately precedes this step's transcript text and return that exact string. Do NOT calculate total seconds.

FRAME INDEXING: When video frames are provided, they are attached as images in chronological order, indexed 0..N-1. For each step, set frameIndex to the 0-based index of the frame that best illustrates it — prefer frames that show hands working on a component over static shots. Omit if no frame clearly fits. Do NOT invent an index outside the provided range.

FRAME ANNOTATIONS: For any frame that clearly shows labellable parts or tools, generate an entry in frameAnnotations. Coordinates are X/Y percentages (0-100) from the top-left corner. Prefer specific part names over generic labels like "part 1".

WARNINGS: Extract all safety warnings, common mistakes, and gotchas.

PROCESS DIAGRAM: Valid Mermaid flowchart TD showing the repair workflow. 8-15 steps. Short alphanumeric labels only.

PARTS DIAGRAM: A clean SVG schematic (viewBox 0 0 800 600).
- White background: <rect width="800" height="600" fill="white"/>
- Title: centered bold text at y=30, font-size 18, fill="#191c1e"
- Components in center region (x: 60–720, y: 50–490); legend bottom-right (x≈540, y≈495)
- Meaningful shapes, not generic boxes. Fill colors by component type (light fill / dark stroke):
    primary parts:   fill="#dbe1ff" stroke="#004cca"
    structural:      fill="#e0e3e5" stroke="#51585e"
    fasteners:       fill="#fef9c3" stroke="#ca8a04"
    seals/gaskets:   fill="#dcfce7" stroke="#16a34a"
    sensors/elec:    fill="#dbeafe" stroke="#2563eb"
    rotating parts:  fill="#f3e8ff" stroke="#9333ea"
    fluid/hoses:     fill="#cffafe" stroke="#0891b2"
- Labels outside shapes with dashed leader lines (stroke="#737687" stroke-dasharray="4,2"). No overlapping labels. Min 20px gap between shapes.
- NO script tags, NO event handlers, NO external hrefs
- Must include xmlns="http://www.w3.org/2000/svg"

IMPORTANT: Never invent part numbers, torque values, or steps not in the transcript/frames/research. Return empty arrays for fields with no data — never null. Mermaid diagram must start with exactly: flowchart TD`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
function secondsToHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function generateRepairGuide(
  transcript: string,
  videoTitle: string,
  videoUrl: string,
  thumbnailUrl: string,
  frames: string[] = [],
  researchContext: string = '',
  commentsContext: string = '',
  providerId: string = 'anthropic',
  modelId: string = 'claude-sonnet-4-6',
  durationSeconds: number = 0
): Promise<RepairGuide> {
  const model = getModel(providerId, modelId);

  const frameNote = frames.length > 0
    ? `\n\n${frames.length} VIDEO FRAMES are attached (chronological, 10%–85% of duration, indexed 0..${frames.length - 1}). Use them to identify component shapes and to set frameIndex on each repair step.`
    : '';

  const researchNote = researchContext
    ? `\n\nREPAIR RESEARCH CONTEXT (authoritative background — cross-reference with video):\n${researchContext}`
    : '';

  const commentsNote = commentsContext
    ? `\n\nVIEWER COMMENTS (top-rated, may contain corrections or model-year notes):\n${commentsContext}`
    : '';

  const durationNote = durationSeconds > 0
    ? `\nVIDEO DURATION: ${secondsToHms(durationSeconds)} (${Math.round(durationSeconds)}s) — timestamps MUST be within this range.`
    : '';

  const userText = `VIDEO TITLE: ${videoTitle}\nVIDEO URL: ${videoUrl}${durationNote}${researchNote}${commentsNote}${frameNote}\n\nTRANSCRIPT:\n${transcript}`;

  const imageContent = frames.map((b64) => ({
    type: 'image' as const,
    image: Buffer.from(b64, 'base64'),
    mimeType: 'image/jpeg' as const,
  }));

  async function callModel(schema: typeof repairGuideSchema, attempt: number) {
    const res = await generateText({
      model,
      maxTokens: 16000,
      system: SYSTEM_PROMPT,
      tools: {
        generate_repair_guide: tool({
          description: 'Extract structured repair guide data from the video transcript, research context, comments, and video frames.',
          parameters: schema,
        }),
      },
      toolChoice: { type: 'tool', toolName: 'generate_repair_guide' },
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userText }, ...imageContent],
        },
      ],
      abortSignal: undefined,
    });
    console.log(`Guide generation attempt ${attempt}: finishReason=${res.finishReason} toolCalls=${res.toolCalls.length}`);
    return res;
  }

  // First attempt — full schema
  let result = await callModel(repairGuideSchema, 1);

  // If truncated or no tool call, retry without the heavy SVG diagram field
  if (!result.toolCalls[0] || result.finishReason === 'length') {
    console.warn(`Retrying without partsDiagram (finishReason=${result.finishReason})`);
    const reducedSchema = repairGuideSchema.omit({ partsDiagram: true });
    result = await callModel(reducedSchema as typeof repairGuideSchema, 2);
  }

  const toolCall = result.toolCalls[0];
  if (!toolCall) {
    throw new Error(
      `Model did not return structured repair guide data (finishReason=${result.finishReason}, text length=${result.text?.length ?? 0}).`
    );
  }

  type GuideInput = z.infer<typeof repairGuideSchema>;
  const extracted = (toolCall as unknown as { args: GuideInput }).args;

  // Map string timestamps to timestampSeconds for the frontend
  if (extracted.repairSteps) {
    for (const step of extracted.repairSteps as any) {
      if (step.timestamp) {
        // Strip out brackets if the LLM included them like "[04:15]"
        const cleanStr = step.timestamp.replace(/[\[\]]/g, '').trim();
        const parts = cleanStr.split(':').map(Number);
        
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          step.timestampSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          step.timestampSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        delete step.timestamp;
      }
      
      // Clamp timestamps beyond the video's actual duration to undefined
      if (step.timestampSeconds != null && durationSeconds > 0 && step.timestampSeconds > durationSeconds) {
        step.timestampSeconds = undefined;
      }

      // Defensive: clamp any out-of-range frameIndex values to undefined
      if (step.frameIndex != null && frames.length > 0) {
        if (step.frameIndex < 0 || step.frameIndex >= frames.length) {
          step.frameIndex = undefined;
        }
      } else if (frames.length === 0) {
        step.frameIndex = undefined;
      }
    }
  }

  return {
    videoTitle,
    videoUrl,
    thumbnailUrl,
    ...(extracted as any),
  };
}
