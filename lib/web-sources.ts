/**
 * Fetch repair-relevant content from external manual/documentation sites.
 * All functions degrade silently — a fetch failure never breaks guide generation.
 */

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const IFIXIT_HEADERS = {
  'User-Agent': 'repair-buddy/1.0 (educational repair guide generator)',
  'Accept': 'application/json',
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_CONTENT_CHARS = 4_000;
const LEMON_BASE = 'https://lemon-manuals.la';

async function fetchWithTimeout(url: string, headers: Record<string, string> = BROWSER_HEADERS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractMainText(html: string): string {
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i)
    ?? html.match(/<article[\s\S]*?<\/article>/i)
    ?? html.match(/<div[^>]+(?:class|id)="[^"]*(?:content|main|article)[^"]*"[\s\S]*?<\/div>/i);
  return stripHtml(mainMatch ? mainMatch[0] : html);
}

function detectSearchUrl(baseUrl: string, html: string): string {
  const formMatch = html.match(/<form[^>]+action=["']([^"']*search[^"']*)["']/i);
  if (formMatch) {
    const action = formMatch[1].startsWith('http') ? formMatch[1] : `${baseUrl}${formMatch[1]}`;
    const paramMatch = html.match(/<input[^>]+name=["'](s|q|query|search)["'][^>]*>/i);
    const param = paramMatch ? paramMatch[1] : 'q';
    return `${action}?${param}=`;
  }
  return `${baseUrl}/?s=`;
}

// ---------------------------------------------------------------------------
// Vehicle extraction from video title
// ---------------------------------------------------------------------------

const KNOWN_MAKES = [
  'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet',
  'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'GMC', 'Genesis', 'Honda',
  'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus',
  'Lincoln', 'Lucid', 'Maserati', 'Mazda', 'Mercedes-Benz', 'Mercury', 'Mini',
  'Mitsubishi', 'Nissan', 'Oldsmobile', 'Plymouth', 'Pontiac', 'Porsche',
  'Ram', 'Rivian', 'Saab', 'Saturn', 'Scion', 'Subaru', 'Suzuki', 'Tesla',
  'Toyota', 'Volkswagen', 'Volvo',
];

// Common abbreviations that appear in titles but differ from Lemon's make names
const MAKE_ALIASES: Record<string, string> = {
  'chevy': 'Chevrolet',
  'vw': 'Volkswagen',
  'mercedes': 'Mercedes-Benz',
  'benz': 'Mercedes-Benz',
  'range rover': 'Land Rover',
};

export interface VehicleHint {
  make: string;
  year: string;
  /** Raw words from the title that follow the make — used for model fuzzy matching */
  modelWords: string[];
}

/**
 * Extract make, year, and likely model words from a video title.
 * Returns null if no make/year can be confidently identified.
 */
export function extractVehicleHint(title: string): VehicleHint | null {
  const lower = title.toLowerCase();

  // Year: 4-digit number in plausible range
  const yearMatch = lower.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  const year = yearMatch?.[1];

  // Check aliases first (multi-word before single-word)
  let make: string | null = null;
  for (const [alias, canonical] of Object.entries(MAKE_ALIASES)) {
    if (lower.includes(alias)) { make = canonical; break; }
  }

  // Then check canonical makes (longest first to avoid "Ford" matching "Oxford")
  if (!make) {
    const sorted = [...KNOWN_MAKES].sort((a, b) => b.length - a.length);
    for (const m of sorted) {
      if (lower.includes(m.toLowerCase())) { make = m; break; }
    }
  }

  if (!make || !year) return null;

  // Grab the words that appear after the make in the title — these are the model hint
  const makeIdx = lower.indexOf(make.toLowerCase());
  const afterMake = title.slice(makeIdx + make.length).trim();
  const modelWords = afterMake
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^\d{4}$/.test(w))  // drop 4-digit years
    .slice(0, 5);

  return { make, year, modelWords };
}

// ---------------------------------------------------------------------------
// Lemon Manuals — vehicle-aware fetcher
// ---------------------------------------------------------------------------

/**
 * Parse all model variant hrefs from a Lemon Manuals make/year listing page.
 * Returns fully-qualified URLs like https://lemon-manuals.la/Honda/2022/Civic%20LX.../
 */
function parseModelLinks(html: string, make: string, year: string): string[] {
  const escapedMake = make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match both relative (/Honda/2022/...) and absolute (https://lemon-manuals.la/Honda/2022/...)
  const pattern = new RegExp(
    `href=["'](?:${LEMON_BASE})?\\/(${escapedMake}\\/${year}\\/[^"'\\/][^"']+?\\/)["']`,
    'gi'
  );
  const seen = new Set<string>();
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    if (!seen.has(path)) {
      seen.add(path);
      links.push(`${LEMON_BASE}/${path}`);
    }
  }
  return links;
}

/**
 * Score a model URL against the video title + model words.
 * Higher = better match.
 */
function scoreModelUrl(url: string, modelWords: string[], titleLower: string): number {
  // Decode the slug: /Honda/2022/Civic%20LX%2C%204D%20Sedan/ → "Civic LX, 4D Sedan"
  const parts = url.replace(LEMON_BASE, '').replace(/^\/|\/$/g, '').split('/');
  const modelSlug = decodeURIComponent(parts[2] ?? '').toLowerCase();
  const modelTokens = modelSlug.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

  let score = 0;
  for (const token of modelTokens) {
    if (token.length < 2) continue;
    if (titleLower.includes(token)) score += 2;
    if (modelWords.some((w) => w.toLowerCase() === token)) score += 3;
  }

  // Prefer base/generic trims when nothing specific matches
  if (score === 0 && /\b(lx|ls|base|s|se|ex)\b/.test(modelSlug)) score = 0.5;

  return score;
}

/**
 * Parse section links from the Lemon Manuals single-page repair index.
 * Returns hrefs of actual content pages (not the index itself).
 */
function parseSectionLinks(html: string, vehicleBaseUrl: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  // Match links that are under the vehicle's path (i.e., actual content pages)
  const pattern = /href=["']([^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    let href = m[1];
    // Resolve relative URLs
    if (href.startsWith('/')) href = `${LEMON_BASE}${href}`;
    if (!href.startsWith(vehicleBaseUrl)) continue;
    // Skip the index page itself and download/labor pages
    if (/\/(Repair%20and%20Diagnosis|Labor|Download)/i.test(href)) continue;
    if (!seen.has(href)) { seen.add(href); links.push(href); }
  }
  return links;
}

/**
 * Score a section link by keyword relevance to the repair topic.
 */
function scoreSectionLink(url: string, keywordsLower: string[]): number {
  const decoded = decodeURIComponent(url).toLowerCase();
  let score = 0;
  for (const kw of keywordsLower) {
    if (decoded.includes(kw)) score++;
  }
  return score;
}

/**
 * Fetch real OEM service manual content from Lemon Manuals for a specific vehicle.
 * Navigates: make/year listing → best-match model → repair index → relevant sections.
 * Returns empty string on any error so it never blocks guide generation.
 */
export async function fetchLemonManualsVehicle(
  vehicle: VehicleHint,
  repairQuery: string
): Promise<string> {
  try {
    // ── 1. Fetch the make/year listing to find exact model URLs ──────────
    const listingUrl = `${LEMON_BASE}/${encodeURIComponent(vehicle.make)}/${vehicle.year}/`;
    const listingHtml = await fetchWithTimeout(listingUrl);
    const modelLinks = parseModelLinks(listingHtml, vehicle.make, vehicle.year);

    if (modelLinks.length === 0) {
      console.warn(`lemon-manuals: no model links found at ${listingUrl}`);
      return '';
    }

    // ── 2. Pick the best-matching model URL ──────────────────────────────
    const titleLower = repairQuery.toLowerCase();
    const scored = modelLinks
      .map((url) => ({ url, score: scoreModelUrl(url, vehicle.modelWords, titleLower) }))
      .sort((a, b) => b.score - a.score);

    const bestModel = scored[0].url;
    console.log(`lemon-manuals: matched model → ${decodeURIComponent(bestModel)} (score ${scored[0].score})`);

    // ── 3. Fetch the single-page repair index ────────────────────────────
    const repairIndexUrl = `${bestModel}Repair%20and%20Diagnosis%20%28Single%20Page%29/`;
    const indexHtml = await fetchWithTimeout(repairIndexUrl);

    // ── 4. Extract and score all section links ────────────────────────────
    const repairKeywords = repairQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const sectionLinks = parseSectionLinks(indexHtml, bestModel);
    const rankedSections = sectionLinks
      .map((url) => ({ url, score: scoreSectionLink(url, repairKeywords) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);  // top 4 most relevant sections

    if (rankedSections.length === 0) {
      // No keyword hits — fall back to the first few sections (common specs etc.)
      rankedSections.push(...sectionLinks.slice(0, 2).map((url) => ({ url, score: 0 })));
    }

    console.log(`lemon-manuals: fetching ${rankedSections.length} sections for "${repairQuery}"`);

    // ── 5. Fetch section pages in parallel ───────────────────────────────
    const chunkSize = Math.floor(MAX_CONTENT_CHARS / Math.max(rankedSections.length, 1));
    const sectionTexts = await Promise.all(
      rankedSections.map(async ({ url }) => {
        try {
          const pageHtml = await fetchWithTimeout(url);
          const text = extractMainText(pageHtml).slice(0, chunkSize);
          if (text.length < 80) return '';
          const label = decodeURIComponent(url.replace(bestModel, '').replace(/\/$/, ''));
          return `[Lemon Manuals — ${label}]\n${text}`;
        } catch {
          return '';
        }
      })
    );

    const combined = sectionTexts.filter(Boolean).join('\n\n');
    if (!combined) return '';

    console.log(`lemon-manuals: ${combined.length} chars from OEM manual for ${vehicle.make} ${vehicle.year}`);
    return combined.slice(0, MAX_CONTENT_CHARS * 2);  // allow more chars since it's real OEM data

  } catch (err) {
    console.warn('lemon-manuals vehicle fetch skipped:', err instanceof Error ? err.message : err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// iFixit
// ---------------------------------------------------------------------------

/**
 * Fetch repair guides from iFixit's public API.
 */
export async function fetchIFixit(query: string): Promise<string> {
  const IFIXIT_API = 'https://www.ifixit.com/api/2.0';
  try {
    const searchRaw = await fetchWithTimeout(
      `${IFIXIT_API}/search/${encodeURIComponent(query)}?doctypes=guide&limit=3`,
      IFIXIT_HEADERS
    );
    const search = JSON.parse(searchRaw) as {
      results?: Array<{ guideid?: number; title?: string; summary?: string }>;
    };

    const hits = (search.results ?? []).filter((r) => r.guideid).slice(0, 2);
    if (hits.length === 0) return '';

    const guideTexts = await Promise.all(
      hits.map(async (hit) => {
        try {
          const guideRaw = await fetchWithTimeout(
            `${IFIXIT_API}/guides/${hit.guideid}`,
            IFIXIT_HEADERS
          );
          const guide = JSON.parse(guideRaw) as {
            title?: string;
            summary?: string;
            tools?: Array<{ text?: string }>;
            parts?: Array<{ text?: string; name?: string }>;
            steps?: Array<{
              title?: string;
              lines?: Array<{ text_raw?: string }>;
            }>;
          };

          const lines: string[] = [`[iFixit: ${guide.title ?? hit.title}]`];
          if (guide.summary) lines.push(`Summary: ${guide.summary}`);
          if (guide.tools?.length)
            lines.push(`Tools: ${guide.tools.map((t) => t.text).filter(Boolean).join(', ')}`);
          if (guide.parts?.length)
            lines.push(`Parts: ${guide.parts.map((p) => p.text ?? p.name).filter(Boolean).join(', ')}`);
          if (guide.steps?.length) {
            lines.push('Steps:');
            for (const step of guide.steps.slice(0, 15)) {
              const stepText = (step.lines ?? []).map((l) => l.text_raw).filter(Boolean).join(' ');
              if (step.title) lines.push(`  ${step.title}: ${stepText}`);
              else if (stepText) lines.push(`  ${stepText}`);
            }
          }

          return lines.join('\n');
        } catch {
          return '';
        }
      })
    );

    const content = guideTexts.filter(Boolean).join('\n\n');
    if (!content) return '';
    console.log(`iFixit: ${content.length} chars fetched for "${query}"`);
    return content.slice(0, MAX_CONTENT_CHARS);
  } catch (err) {
    console.warn('iFixit fetch skipped:', err instanceof Error ? err.message : err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Lemon Manuals — generic search fallback (used when no vehicle is identified)
// ---------------------------------------------------------------------------

/**
 * Generic keyword search on lemon-manuals.la.
 * Used as a fallback when no make/year can be extracted from the title.
 */
export async function fetchLemonManuals(query: string): Promise<string> {
  const BASE = LEMON_BASE;
  try {
    const homeHtml = await fetchWithTimeout(BASE).catch(() => '');
    const searchBase = homeHtml ? detectSearchUrl(BASE, homeHtml) : `${BASE}/?s=`;

    const searchUrl = `${searchBase}${encodeURIComponent(query)}`;
    const searchHtml = await fetchWithTimeout(searchUrl);

    const linkPattern = /href=["'](https?:\/\/lemon-manuals\.la\/[^"'#?]+)["']/gi;
    const links: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkPattern.exec(searchHtml)) !== null && links.length < 3) {
      const href = m[1];
      if (/\/(category|tag|page|author|feed)\//i.test(href)) continue;
      if (!links.includes(href)) links.push(href);
    }

    const chunks: string[] = [];

    const searchText = extractMainText(searchHtml).slice(0, MAX_CONTENT_CHARS / 2);
    if (searchText.length > 100) chunks.push(`[lemon-manuals.la search results]\n${searchText}`);

    for (const link of links.slice(0, 2)) {
      try {
        const pageHtml = await fetchWithTimeout(link);
        const text = extractMainText(pageHtml).slice(0, MAX_CONTENT_CHARS / 2);
        if (text.length > 100) chunks.push(`[lemon-manuals.la: ${link}]\n${text}`);
      } catch {
        // ignore individual page fetch failures
      }
    }

    if (chunks.length === 0) return '';
    console.log(`lemon-manuals.la search: ${chunks.join('').length} chars for "${query}"`);
    return chunks.join('\n\n').slice(0, MAX_CONTENT_CHARS);
  } catch (err) {
    console.warn('lemon-manuals.la fetch skipped:', err instanceof Error ? err.message : err);
    return '';
  }
}
