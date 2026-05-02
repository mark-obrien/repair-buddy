import Anthropic from '@anthropic-ai/sdk';
import type { RepairGuide } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 55_000,
});

const SYSTEM_PROMPT = `You are an expert automotive and appliance repair technician with 20+ years of experience. You specialize in analyzing repair video transcripts and extracting precise, actionable information for DIY repair guides.

Your job is to analyze YouTube video transcripts and extract structured data for a repair companion guide. Focus on:

PARTS: Extract every part mentioned — OEM part numbers, aftermarket options, quantities, and any brand recommendations. Common parts include filters, gaskets, seals, bolts, sensors, bearings, and consumables like fluids and lubricants. Only include part numbers if explicitly stated verbally in the transcript — do not construct or infer part numbers.

STANDARD TOOLS: Extract all common tools mentioned such as socket sets, wrenches (box, open-end, combination), screwdrivers, pliers, ratchets, extensions, torque wrenches, breaker bars, hammers, pry bars, drain pans, funnels, and similar workshop equipment. Always include the size or specification where mentioned (e.g., "10mm socket", "3/8 drive ratchet", "flathead screwdriver").

SPECIALTY TOOLS: Identify tools that are not part of a standard home workshop. Examples include: harmonic balancer pullers, spring compressors, valve spring compressors, timing light, scan/diagnostic tools (OBD2 scanners), compression testers, leak-down testers, torque-angle adapters, bearing drivers, seal drivers, pitman arm pullers, ball joint presses, brake caliper wind-back tools, flywheel holding tools, cam lock tools, and any brand-specific specialty tools. Always note the purpose of the specialty tool and any DIY alternative method mentioned.

TORQUE VALUES: Extract every single torque specification mentioned in the transcript. Note the exact component name, numeric value, and unit (ft-lbs, Nm, in-lbs, kg-m). Include multi-stage torque sequences and angle-tightening instructions as notes. Torque values are critical safety information — extract them precisely as stated, never round or estimate. A missed torque spec can lead to serious injury or component failure.

REPAIR STEPS: Extract the logical sequence of repair steps from the transcript. Each step should be self-contained and actionable. Include any step-specific warnings or cautions inline. Aim for 8 to 20 steps representing the complete repair procedure from preparation through final testing. Number steps sequentially starting from 1.

WARNINGS AND CAUTIONS: Extract all safety warnings, cautions about common mistakes, things that can damage parts if done incorrectly, information that voids warranties, and any specific "gotchas" the presenter calls out. Include both general job-level warnings (hot surfaces, pressurized systems, spring tension hazards) and any mistakes beginners commonly make.

PROCESS DIAGRAM: Generate a syntactically valid Mermaid flowchart that shows the repair workflow. Use flowchart TD (top-down) format. Requirements for valid syntax:
- Start with exactly: flowchart TD
- Keep all node labels under 30 characters
- Use only alphanumeric characters, spaces, and hyphens inside node labels
- If a label needs special characters, wrap it in double quotes: A["Label with (parens)"]
- Use diamond nodes for inspection or decision points: D{Check condition}
- Use rectangular nodes for action steps: A[Do something]
- Represent 8 to 15 key steps — not every micro-step, but the major phases
- Arrow syntax: A --> B or A -->|condition| B

PARTS DIAGRAM: Generate a complete, self-contained SVG schematic showing the physical layout and component relationships for this repair. This is a spatial/structural diagram showing what the parts look like and where they sit relative to each other — NOT a process flowchart. If video frames are provided, base the component shapes, positions, and labels on what is actually visible in the frames. If no frames are provided, use your general knowledge of the repair type.

SVG requirements:
- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="auto">
- Do NOT include <?xml?> declarations, DOCTYPE, or <html> wrappers
- Do NOT use <script> tags, on* event attributes, or javascript: URIs
- Do NOT reference external resources (no xlink:href to URLs, no @import)
- All styles must be inline or in an embedded <style> block within the SVG
- Include a white/light background rect covering the full viewBox: <rect width="800" height="600" fill="#f8fafc"/>
- Add a centered title at the top (y=30) in bold 16px showing the repair type (e.g. "Timing Belt — Component Layout")

COMPONENT LAYOUT:
- Arrange 8 to 16 labeled components in their approximate physical/spatial relationship
- Use simple geometric shapes: rect for flat/rectangular parts, ellipse/circle for round parts, polygon for brackets
- Draw thin connector lines (stroke="#94a3b8", stroke-width="1", stroke-dasharray="4 2") between mechanically related components
- Leave adequate whitespace between components so labels are readable

COLOR CODING (use consistently):
- Primary part being replaced: fill="#fed7aa" stroke="#f97316" (orange)
- Structural/housing parts (engine block, valve cover, housing): fill="#e2e8f0" stroke="#94a3b8" (slate)
- Fasteners (bolts, nuts, studs): fill="#fef9c3" stroke="#ca8a04" (yellow)
- Seals, gaskets, o-rings: fill="#dcfce7" stroke="#16a34a" (green)
- Sensors and electrical: fill="#dbeafe" stroke="#2563eb" (blue)
- Rotating parts (pulleys, gears): fill="#f3e8ff" stroke="#9333ea" (purple)
- Fluid parts (pumps, hoses): fill="#cffafe" stroke="#0891b2" (cyan)

LABELS:
- Every component must have a text label in font-family: system-ui, sans-serif; font-size: 12px; fill: #1e293b
- Place labels outside the component shape with a short leader line where space is tight
- Add a white backing rect behind each label for readability
- Where torque specs apply, add a small annotation badge: <rect fill="#fef3c7" stroke="#f59e0b"/> with the torque value (e.g. "47 Nm")

LEGEND:
- Include a legend box in the bottom-right corner (x=570, y=410, width=220, height=175)
- Legend background: <rect fill="white" stroke="#e2e8f0"/>
- "Component Legend" as bold 12px title inside the legend
- Show each color category present in the diagram as a 12x12 colored rect with a text label

IMPORTANT RULES:
- If information is not explicitly mentioned in the transcript, return an empty array — do NOT invent, infer, or fabricate data
- Return empty arrays for any field with no data — never return null
- Torque values must exactly match what was stated — never round or estimate
- Part numbers must be explicitly stated verbally — never construct them from model numbers or context
- The Mermaid diagram must be syntactically valid — the first line must be exactly: flowchart TD
- Do not reference timestamps, video chapter markers, or the presenter's name in your output
- The summary should be 2-4 sentences describing what repair is covered and the overall approach`;

const REPAIR_GUIDE_TOOL: Anthropic.Tool = {
  name: 'generate_repair_guide',
  description:
    'Extract structured repair guide information from a YouTube video transcript. Populate all fields with data explicitly found in the transcript. Return empty arrays for fields with no data.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description: '2-4 sentence summary of what repair is covered and the overall approach',
      },
      partsNeeded: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            partNumber: {
              type: 'string',
              description: 'OEM or aftermarket part number only if explicitly stated',
            },
            quantity: { type: 'number' },
            notes: {
              type: 'string',
              description: 'Brand recommendations, fitment notes, fluid spec, etc.',
            },
          },
          required: ['name'],
        },
      },
      standardTools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            size: { type: 'string', description: 'Socket size, wrench size, bit size, etc.' },
            notes: { type: 'string' },
          },
          required: ['name'],
        },
      },
      specialtyTools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            purpose: { type: 'string' },
            altMethod: {
              type: 'string',
              description: 'Alternative DIY method if specialty tool is unavailable',
            },
          },
          required: ['name', 'purpose'],
        },
      },
      torqueValues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            component: { type: 'string' },
            value: { type: 'string' },
            unit: {
              type: 'string',
              enum: ['ft-lbs', 'Nm', 'in-lbs', 'kg-m'],
            },
            notes: {
              type: 'string',
              description: 'Stage torque, angle tightening, sequence info, etc.',
            },
          },
          required: ['component', 'value', 'unit'],
        },
      },
      repairSteps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            step: { type: 'number' },
            title: { type: 'string', description: 'Short title for this step (5-10 words)' },
            description: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } },
          },
          required: ['step', 'title', 'description'],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Global warnings and cautions that apply to the entire job',
      },
      diagram: {
        type: 'string',
        description:
          "Valid Mermaid flowchart TD syntax showing the repair process. Must start with 'flowchart TD' on the first line. Use short labels (max 30 chars). Only alphanumeric, spaces, hyphens in labels.",
      },
      partsDiagram: {
        type: 'string',
        description:
          'A complete self-contained SVG string showing the physical layout and component relationships. Root element must be <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="auto">. NO script tags, NO on* event attributes, NO external href references. Color coding: primary part=fill #fed7aa stroke #f97316, structural=fill #e2e8f0 stroke #94a3b8, fasteners=fill #fef9c3 stroke #ca8a04, seals/gaskets=fill #dcfce7 stroke #16a34a, sensors=fill #dbeafe stroke #2563eb, rotating=fill #f3e8ff stroke #9333ea, fluid=fill #cffafe stroke #0891b2. Every component labeled in 12px system-ui. Legend box in bottom-right. 8-16 labeled components. This is a PHYSICAL LAYOUT diagram, not a flowchart.',
      },
    },
    required: [
      'summary',
      'partsNeeded',
      'standardTools',
      'specialtyTools',
      'torqueValues',
      'repairSteps',
      'warnings',
      'diagram',
      'partsDiagram',
    ],
  },
};

type GuideInput = Omit<RepairGuide, 'videoTitle' | 'videoUrl' | 'thumbnailUrl'>;

export async function generateRepairGuide(
  transcript: string,
  videoTitle: string,
  videoUrl: string,
  thumbnailUrl: string,
  frames: string[] = []
): Promise<RepairGuide> {
  const frameNote = frames.length > 0
    ? `\n\nVIDEO FRAMES: ${frames.length} frames extracted from the video are provided below as images. Use these to identify actual component shapes, positions, labels, and spatial relationships when generating the parts diagram SVG. The frames are ordered chronologically from ~10% to ~85% of the video duration.`
    : '';

  // Build content blocks: text first (cached), then images (not cached — unique per video)
  const userContent: Anthropic.MessageParam['content'] = [
    {
      type: 'text',
      text: `VIDEO TITLE: ${videoTitle}\nVIDEO URL: ${videoUrl}${frameNote}\n\nTRANSCRIPT:\n${transcript}`,
      cache_control: { type: 'ephemeral' },
    },
    ...frames.map((b64): Anthropic.ImageBlockParam => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: b64,
      },
    })),
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 12000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [REPAIR_GUIDE_TOOL],
    tool_choice: { type: 'tool', name: 'generate_repair_guide' },
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('Claude did not return structured repair guide data.');
  }

  const extracted = toolUseBlock.input as GuideInput;

  return {
    videoTitle,
    videoUrl,
    thumbnailUrl,
    ...extracted,
  };
}
