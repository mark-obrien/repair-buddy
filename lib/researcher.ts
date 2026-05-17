import { generateText } from 'ai';
import { getModel } from './providers';
import { fetchLemonManuals, fetchLemonManualsVehicle, fetchIFixit, extractVehicleHint, type ManualImage, type ManualLink } from './web-sources';

export type { ManualImage, ManualLink };

const RESEARCH_SYSTEM_PROMPT = `You are a master repair technician with encyclopedic knowledge across automotive, home improvement, appliances, electronics, outdoor equipment, and general DIY repair.

When given a repair video title, identify the repair domain and provide a concise but thorough research summary covering:

1. PROCEDURE OVERVIEW: The standard sequence of steps for this repair, including non-obvious prerequisites (e.g., "engine must be cold", "shut off water at main", "discharge capacitors before touching").

2. CRITICAL PARTS & MATERIALS: Typical parts, materials, or consumables involved — names, categories, and what to inspect even if not replacing. Include common spec requirements (e.g., wire gauge, pipe size, torque values, fluid spec).

3. SPECIALTY TOOLS: Any non-standard tools commonly required and what happens if you attempt the job without them.

4. COMMON MISTAKES: The top mistakes DIYers make on this repair that cause failures, damage, or safety hazards.

5. SAFETY CONSIDERATIONS: Hazards specific to this repair (stored energy, pressurized systems, live electrical, gas lines, structural loading, asbestos risk, etc.).

6. CODE OR COMPLIANCE NOTES (if applicable): For home/electrical/HVAC work, note any permit requirements, inspection points, or code considerations.

Be factual and precise. If the repair type is ambiguous from the title, cover the most common interpretation. Keep the response focused — this is background context for a video analysis, not a standalone guide.`;

/**
 * Strip common YouTube title filler so external searches get cleaner queries.
 * e.g. "How to Replace Front Brake Pads on a 2019 Honda Accord (EASY DIY!)"
 *   → "Replace Front Brake Pads 2019 Honda Accord"
 */
function cleanSearchQuery(title: string): string {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/^(how\s+to|how\s+i|diy|easy|quick|step[\s-]by[\s-]step|complete\s+guide|tutorial|the\s+ultimate|watch\s+me|let['']?s|i\s+fixed|i\s+replaced|fixing|replacing|repairing)\s+/gi, '')
    .replace(/\b(at\s+home|on\s+a|on\s+my|in\s+minutes?|for\s+beginners?|with\s+basic\s+tools?)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);
}

export interface ResearchResult {
  text: string;
  manualImages: ManualImage[];
  manualLinks: ManualLink[];
}

export async function researchRepairTopic(
  videoTitle: string,
  providerId: string,
  modelId: string
): Promise<ResearchResult> {
  const researchModelId = getResearchModel(providerId, modelId);
  const model = getModel(providerId, researchModelId);

  const searchQuery = cleanSearchQuery(videoTitle);
  const vehicle = extractVehicleHint(videoTitle);

  if (vehicle) {
    console.log(`Research: detected vehicle ${vehicle.make} ${vehicle.year} [${vehicle.modelWords.join(' ')}]`);
  }
  console.log(`Research query: "${searchQuery}"`);

  // Choose Lemon Manuals strategy based on whether we identified a vehicle.
  // Vehicle-aware path navigates directly to the OEM service manual.
  // Fallback does a generic keyword search.
  const lemonFetch = vehicle
    ? fetchLemonManualsVehicle(vehicle, searchQuery)
    : fetchLemonManuals(searchQuery);

  const [lemonResult, ifixitContent, aiResult] = await Promise.all([
    lemonFetch,
    fetchIFixit(searchQuery),
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
  if (lemonResult.text) {
    const label = vehicle
      ? `OEM SERVICE MANUAL (lemon-manuals.la — ${vehicle.make} ${vehicle.year})`
      : 'MANUAL SOURCE (lemon-manuals.la)';
    parts.push(`\n---\n${label}:\n${lemonResult.text}`);
  }
  if (ifixitContent) parts.push(`\n---\nREPAIR GUIDE SOURCE (iFixit):\n${ifixitContent}`);

  return {
    text: parts.join('\n'),
    manualImages: lemonResult.images ?? [],
    manualLinks: lemonResult.links ?? [],
  };
}

function getResearchModel(providerId: string, selectedModelId: string): string {
  const fastModels: Record<string, string> = {
    anthropic: 'claude-haiku-4-5-20251001',
    openai: 'gpt-4o-mini',
    google: 'gemini-2.5-flash',
  };
  return fastModels[providerId] ?? selectedModelId;
}
