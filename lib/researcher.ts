import { generateText } from 'ai';
import { getModel } from './providers';
import { fetchLemonManuals } from './web-sources';
import type { RepairCategory } from './types';

const RESEARCH_PROMPTS: Record<RepairCategory, string> = {
  auto: `You are a master automotive technician with encyclopedic knowledge of repair procedures, specifications, and best practices for cars, trucks, and light commercial vehicles.

When given a repair video title, provide a concise but thorough research summary covering:

1. PROCEDURE OVERVIEW: The standard sequence of steps for this repair, including any non-obvious prerequisites (e.g., "engine must be cold", "relieve fuel pressure first").

2. CRITICAL PARTS: The typical parts involved — names, categories (gasket, seal, sensor, filter, etc.), and what to inspect even if not replacing.

3. TYPICAL TORQUE SPECS: Any well-known torque specifications for this repair type. Mark these as "typical" since exact values depend on the specific vehicle.

4. SPECIALTY TOOLS: Any specialty tools commonly required and what happens if you attempt the job without them.

5. COMMON MISTAKES: The top mistakes DIYers make on this repair that cause failures or comebacks.

6. SAFETY CONSIDERATIONS: Hazards specific to this repair (springs under tension, stored energy, pressurized systems, high-voltage components, etc.).

Be factual and precise. Keep the response focused — this is background context for a video analysis, not a standalone guide.`,

  home: `You are a master home repair and improvement technician with encyclopedic knowledge across plumbing, electrical, HVAC, carpentry, appliances, and general building systems.

When given a repair video title, provide a concise but thorough research summary covering:

1. PROCEDURE OVERVIEW: The standard sequence of steps for this repair, including non-obvious prerequisites (e.g., "shut off water at main", "turn off breaker and verify with tester").

2. CRITICAL PARTS & MATERIALS: Typical parts, materials, or consumables involved — include common brand/model examples and spec requirements (e.g., pipe diameter, wire gauge, R-value).

3. CODE & PERMIT CONSIDERATIONS: Any building code requirements, permit obligations, or inspection checkpoints relevant to this type of work.

4. SPECIALTY TOOLS: Tools beyond a basic homeowner toolkit, and what happens without them.

5. COMMON MISTAKES: The top mistakes DIYers make that cause leaks, failures, code violations, or safety hazards.

6. SAFETY CONSIDERATIONS: Hazards specific to this repair (live electrical, asbestos risk, structural loading, gas lines, water damage, etc.).

Be factual and precise. Keep the response focused — this is background context for a video analysis, not a standalone guide.`,
};

export async function researchRepairTopic(
  videoTitle: string,
  providerId: string,
  modelId: string,
  category: RepairCategory = 'auto'
): Promise<string> {
  const researchModelId = getResearchModel(providerId, modelId);
  const model = getModel(providerId, researchModelId);

  const [manualContent, aiResult] = await Promise.all([
    fetchLemonManuals(videoTitle),
    generateText({
      model,
      maxTokens: 1500,
      system: RESEARCH_PROMPTS[category],
      prompt: `Repair video title: "${videoTitle}"\n\nProvide repair background research for this topic.`,
      abortSignal: undefined,
    }).catch((err) => {
      console.warn('Research phase failed:', err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  const parts: string[] = [];
  if (aiResult?.text) parts.push(aiResult.text);
  if (manualContent) {
    parts.push(`\n---\nMANUAL SOURCE (lemon-manuals.la):\n${manualContent}`);
    console.log(`lemon-manuals.la: ${manualContent.length} chars fetched`);
  }
  return parts.join('\n');
}

function getResearchModel(providerId: string, selectedModelId: string): string {
  const fastModels: Record<string, string> = {
    anthropic: 'claude-haiku-4-5-20251001',
    openai: 'gpt-4o-mini',
    google: 'gemini-2.5-flash',
  };
  return fastModels[providerId] ?? selectedModelId;
}
