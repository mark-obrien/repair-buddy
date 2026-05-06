import { generateText } from 'ai';
import { getModel } from './providers';
import { fetchLemonManuals } from './web-sources';

const RESEARCH_SYSTEM_PROMPT = `You are a master automotive and appliance repair technician with encyclopedic knowledge of repair procedures, specifications, and best practices.

When given a repair video title, provide a concise but thorough research summary covering:

1. PROCEDURE OVERVIEW: The standard sequence of steps for this repair, including any non-obvious prerequisites (e.g., "engine must be cold", "relieve fuel pressure first").

2. CRITICAL PARTS: The typical parts involved in this repair — names, categories (gasket, seal, sensor, filter, etc.), and what to inspect even if not replacing.

3. TYPICAL TORQUE SPECS: Any well-known torque specifications for this repair type. Mark these as "typical" since the exact values depend on the specific vehicle/appliance.

4. SPECIALTY TOOLS: Any specialty tools commonly required and what happens if you attempt the job without them.

5. COMMON MISTAKES: The top mistakes DIYers make on this repair that cause failures or comebacks.

6. SAFETY CONSIDERATIONS: Hazards specific to this repair (springs under tension, stored energy, pressurized systems, high-voltage components, etc.).

Be factual and precise. If the repair type is ambiguous from the title, cover the most common interpretation. Keep the response focused — this is background context for a video analysis, not a standalone guide.`;

export async function researchRepairTopic(
  videoTitle: string,
  providerId: string,
  modelId: string
): Promise<string> {
  const researchModelId = getResearchModel(providerId, modelId);
  const model = getModel(providerId, researchModelId);

  // Fetch external manual content in parallel with nothing (fire and forget
  // alongside the AI call below — both resolve independently)
  const [manualContent, aiResult] = await Promise.all([
    fetchLemonManuals(videoTitle),
    generateText({
      model,
      maxTokens: 1500,
      system: RESEARCH_SYSTEM_PROMPT,
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
