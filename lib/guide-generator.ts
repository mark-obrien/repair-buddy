import { generateText, tool } from 'ai';
import { z } from 'zod';
import { getModel } from './providers';
import type { RepairGuide } from './types';

// ---------------------------------------------------------------------------
// Zod schema — single source of truth for the structured output
// ---------------------------------------------------------------------------
const repairGuideSchema = z.object({
  summary: z.string().describe('2-4 sentence summary of what repair is covered and the overall approach'),

  partsNeeded: z.array(z.object({
    name: z.string(),
    partNumber: z.string().optional().describe('OEM or aftermarket part number only if explicitly stated'),
    quantity: z.number().optional(),
    notes: z.string().optional().describe('Brand recommendations, fitment notes, fluid spec, etc.'),
  })),

  standardTools: z.array(z.object({
    name: z.string(),
    size: z.string().optional().describe('Socket size, wrench size, bit size, etc.'),
    notes: z.string().optional(),
  })),

  specialtyTools: z.array(z.object({
    name: z.string(),
    purpose: z.string(),
    altMethod: z.string().optional().describe('Alternative DIY method if specialty tool unavailable'),
  })),

  torqueValues: z.array(z.object({
    component: z.string(),
    value: z.string(),
    unit: z.enum(['ft-lbs', 'Nm', 'in-lbs', 'kg-m']),
    notes: z.string().optional().describe('Stage torque, angle tightening, sequence info, etc.'),
  })),

  repairSteps: z.array(z.object({
    step: z.number(),
    title: z.string().describe('Short title for this step (5-10 words)'),
    description: z.string(),
    warnings: z.array(z.string()).optional(),
  })),

  warnings: z.array(z.string()).describe('Global warnings and cautions that apply to the entire job'),

  diagram: z.string().describe(
    "Valid Mermaid flowchart TD syntax. First line must be 'flowchart TD'. Short labels only."
  ),

  partsDiagram: z.string().describe(
    'Complete self-contained SVG schematic. Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">. White background rect first. Title at top. Components in center region. Legend box bottom-right. No scripts, no external refs.'
  ),
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an expert automotive and appliance repair technician with 20+ years of experience. You specialize in analyzing repair video transcripts and extracting precise, actionable information for DIY repair guides.

When research context is provided, use it as authoritative background knowledge. Cross-reference it against the video transcript and frames to produce the most accurate and complete guide possible. If the video contradicts the research on a factual point (e.g. a torque spec), prefer the video's explicit value but note the discrepancy.

PARTS: Extract every part mentioned — OEM part numbers, aftermarket options, quantities, and brand recommendations. Only include part numbers if explicitly stated verbally.

STANDARD TOOLS: Extract all common tools mentioned with sizes/specifications where given.

SPECIALTY TOOLS: Identify non-standard tools. Always note purpose and any DIY alternative.

TORQUE VALUES: Extract every torque specification precisely as stated — never round or estimate. These are safety-critical.

REPAIR STEPS: Extract 8-20 logical, actionable steps covering the full procedure. Include step-specific warnings inline.

WARNINGS: Extract all safety warnings, common mistakes, and "gotchas."

PROCESS DIAGRAM: Valid Mermaid flowchart TD showing the repair workflow. 8-15 steps. Short alphanumeric labels only.

PARTS DIAGRAM: A clean, detailed SVG schematic (viewBox 0 0 800 600) of the physical component layout.

REQUIRED STRUCTURE:
1. White background: <rect width="800" height="600" fill="white"/>
2. Title: centered bold text at y=30, font-size 18, describing the specific repair
3. Components drawn in center region (x: 60–720, y: 50–490)
4. Legend box anchored at bottom-right (x≈540, y≈495, width≈245, height auto)

COMPONENTS (8–14 parts):
- Draw each as a meaningful shape (rect, circle, ellipse, path) — not just generic boxes
- Fill/stroke by type: primary=#fed7aa/#f97316, structural=#e2e8f0/#94a3b8, fasteners=#fef9c3/#ca8a04, seals=#dcfce7/#16a34a, sensors=#dbeafe/#2563eb, rotating=#f3e8ff/#9333ea, fluid=#cffafe/#0891b2
- Bold component name label (font-size 12, font-weight bold, font-family system-ui) placed OUTSIDE the shape with a dashed leader line (<line stroke-dasharray="4 2" stroke="#999"/>)
- If video frames were provided, reflect actual shapes and positions visible in the frames

LEGEND (bottom-right box):
- Thin border rect, light gray background (#f9fafb)
- "Legend" heading, then one row per color used: colored swatch rect (14×14) + label

QUALITY RULES:
- No overlapping labels
- Minimum 20px gap between component shapes
- All text within viewBox bounds (x: 5–795, y: 12–595)
- NO script tags, NO event handlers, NO external hrefs

IMPORTANT RULES:
- Never invent part numbers, torque values, or steps not found in the transcript/frames/research
- Return empty arrays for fields with no data — never null
- The Mermaid diagram must start with exactly: flowchart TD
- The SVG must include xmlns="http://www.w3.org/2000/svg"`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function generateRepairGuide(
  transcript: string,
  videoTitle: string,
  videoUrl: string,
  thumbnailUrl: string,
  frames: string[] = [],
  researchContext: string = '',
  providerId: string = 'anthropic',
  modelId: string = 'claude-sonnet-4-6'
): Promise<RepairGuide> {
  const model = getModel(providerId, modelId);

  const frameNote = frames.length > 0
    ? `\n\n${frames.length} VIDEO FRAMES are attached (chronological, 10%–85% of duration). Use them to identify actual component shapes and positions for the parts diagram.`
    : '';

  const researchNote = researchContext
    ? `\n\nREPAIR RESEARCH CONTEXT (authoritative background — cross-reference with video):\n${researchContext}`
    : '';

  const userText = `VIDEO TITLE: ${videoTitle}\nVIDEO URL: ${videoUrl}${researchNote}${frameNote}\n\nTRANSCRIPT:\n${transcript}`;

  const result = await generateText({
    model,
    maxOutputTokens: 12000,
    system: SYSTEM_PROMPT,
    tools: {
      generate_repair_guide: tool({
        description: 'Extract structured repair guide data from the video transcript, research context, and video frames.',
        inputSchema: repairGuideSchema,
      }),
    },
    toolChoice: { type: 'tool', toolName: 'generate_repair_guide' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          ...frames.map((b64) => ({
            type: 'image' as const,
            image: Buffer.from(b64, 'base64'),
            mimeType: 'image/jpeg' as const,
          })),
        ],
      },
    ],
    abortSignal: AbortSignal.timeout(180_000),
  });

  const toolCall = result.toolCalls[0];
  if (!toolCall) {
    throw new Error('Model did not return structured repair guide data.');
  }

  type GuideInput = z.infer<typeof repairGuideSchema>;
  const extracted = (toolCall as { input: GuideInput }).input;

  return {
    videoTitle,
    videoUrl,
    thumbnailUrl,
    ...extracted,
  };
}
