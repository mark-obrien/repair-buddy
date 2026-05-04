import { generateText, tool } from 'ai';
import { z } from 'zod';
import { getModel } from './providers';
import type { Scene3D } from './types';

// ---------------------------------------------------------------------------
// Zod schema — structured 3D scene output
// ---------------------------------------------------------------------------

const componentSchema = z.object({
  id: z.string().describe('snake_case unique id, e.g. "engine_block"'),
  name: z.string().describe('Short human-readable name, e.g. "Engine Block"'),
  shape: z.enum(['box', 'cylinder', 'sphere', 'cone', 'torus']),
  width: z.number().describe('Width in scene units (1 unit ≈ 1 cm)'),
  height: z.number().describe('Height in scene units'),
  depth: z.number().describe('Depth in scene units'),
  x: z.number().describe('X position — positive = right of center'),
  y: z.number().describe('Y position — positive = above center'),
  z: z.number().describe('Z position — positive = toward viewer'),
  rotX: z.number().describe('X-axis rotation in radians').default(0),
  rotY: z.number().describe('Y-axis rotation in radians').default(0),
  rotZ: z.number().describe('Z-axis rotation in radians').default(0),
  color: z.string().describe('Hex color matching the category exactly'),
  category: z.enum(['primary', 'structural', 'fastener', 'seal', 'sensor', 'fluid', 'rotating']),
  description: z.string().optional().describe('One sentence: role of this part in the assembly'),
});

const sceneSchema = z.object({
  title: z.string().describe('e.g. "Brake Caliper Exploded View"'),
  components: z.array(componentSchema).min(4).max(14),
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a mechanical visualization engineer creating 3D exploded-view schematics from repair video frames.

Given video frames and a parts list, produce a 3D scene spec for an interactive Three.js viewer. Map each major physical component to a basic 3D primitive positioned in a clear exploded arrangement.

━━━ COORDINATE SYSTEM ━━━
• Origin (0,0,0) = center of the assembled unit
• Y-axis = UP
• 1 unit ≈ 1 cm in real life
• Minimum 1.5 unit gap between component surfaces — components must never overlap
• Arrange parts radially outward from origin in their natural relative direction

━━━ SHAPE MAPPING ━━━
box       → flat plates, blocks, housings, gaskets, brackets, covers, filters
cylinder  → bolts, studs, shafts, pistons, hoses, bushings, caps, barrels
sphere    → ball joints, rubber mounts, rounded end caps
cone      → tapered shafts, valves with tapered bodies, funnels
torus     → O-rings, circular gaskets, drive belts (cross-section ring)

━━━ SIZE REFERENCE (width × height × depth, units ≈ cm) ━━━
Large housing / engine block / caliper body:   5–6 × 4–5 × 5–6
Medium part (valve, bracket, pump body):       1.5–3 × 1–2.5 × 1.5–3
Cover plate / flat gasket (box):               3–5 × 0.1–0.3 × 3–5
Bolt (cylinder, use width=0.5–0.7):            0.6 w × 1.5–2.5 h × 0.6 d
O-ring (torus, outer radius = width/2):        width 2–4, height 0.3–0.6, depth 0.3
Sensor / switch:                               0.8 × 1.5 × 0.8

━━━ COLORS — use exactly these hex values ━━━
primary    #f97316   the main component being repaired or replaced
structural #94a3b8   housings, blocks, brackets, frames
fastener   #ca8a04   bolts, nuts, clips, retaining rings
seal       #16a34a   gaskets, O-rings, seals, boots
sensor     #2563eb   sensors, switches, solenoids, connectors
fluid      #0891b2   pumps, fluid lines, reservoirs, accumulators
rotating   #9333ea   gears, pulleys, shafts, camshafts, drive belts

━━━ LAYOUT RULES ━━━
• Main assembly part (block, caliper body, housing): place near origin (small offset)
• Parts attached above: positive Y, spread slightly in X/Z
• Parts on sides: spread in X or Z matching real assembly direction
• Parts beneath: negative Y
• Fasteners: cluster 2–3 units away from the surface they fasten; spread as a group
• For repeated fasteners (4 bolts), place them in a small cluster not all at one point

Generate 6–14 components. Use the frames to infer actual 3D shapes and spatial relationships. Write a one-sentence description for each component.`;

// ---------------------------------------------------------------------------
// Guide context passed from client (slimmed-down subset of RepairGuide)
// ---------------------------------------------------------------------------

export interface SceneGuideContext {
  videoTitle: string;
  summary: string;
  partsNeeded: Array<{ name: string; notes?: string }>;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateScene3D(
  frames: string[],
  guide: SceneGuideContext,
  providerId = 'anthropic',
  modelId = 'claude-sonnet-4-6'
): Promise<Scene3D> {
  const model = getModel(providerId, modelId);

  const partsText = guide.partsNeeded
    .slice(0, 12)
    .map((p) => `• ${p.name}${p.notes ? ` — ${p.notes}` : ''}`)
    .join('\n');

  const userText = [
    `VIDEO: ${guide.videoTitle}`,
    `SUMMARY: ${guide.summary}`,
    `\nIDENTIFIED PARTS:\n${partsText}`,
    `\nCreate a 3D exploded-view scene for this repair assembly. Use the video frames to understand the actual component shapes and spatial relationships.`,
  ].join('\n');

  const result = await generateText({
    model,
    maxTokens: 4000,
    system: SYSTEM_PROMPT,
    tools: {
      generate_3d_scene: tool({
        description: 'Generate a 3D exploded-view scene specification for the repair assembly.',
        parameters: sceneSchema,
      }),
    },
    toolChoice: { type: 'tool', toolName: 'generate_3d_scene' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          // Send up to 6 frames — enough for shape/layout inference without huge payload
          ...frames.slice(0, 6).map((b64) => ({
            type: 'image' as const,
            image: Buffer.from(b64, 'base64'),
            mimeType: 'image/jpeg' as const,
          })),
        ],
      },
    ],
    abortSignal: undefined,
  });

  const toolCall = result.toolCalls[0];
  if (!toolCall) throw new Error('AI did not return scene data.');

  type SceneInput = z.infer<typeof sceneSchema>;
  const raw = (toolCall as unknown as { args: SceneInput }).args;

  // Ensure rotation defaults
  const components = raw.components.map((c) => ({
    ...c,
    rotX: c.rotX ?? 0,
    rotY: c.rotY ?? 0,
    rotZ: c.rotZ ?? 0,
  }));

  return { title: raw.title, components };
}
