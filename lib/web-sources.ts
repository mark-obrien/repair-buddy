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
  'chevy\'s': 'Chevrolet',
  'vw': 'Volkswagen',
  'mercedes': 'Mercedes-Benz',
  'benz': 'Mercedes-Benz',
  'range rover': 'Land Rover',
  'bimmer': 'BMW',
  'beemer': 'BMW',
  'subie': 'Subaru',
  'mopar': 'Dodge',
  // Popular model names that unambiguously identify a make
  'silverado': 'Chevrolet',
  'tahoe': 'Chevrolet',
  'suburban': 'Chevrolet',
  'colorado': 'Chevrolet',
  'equinox': 'Chevrolet',
  'traverse': 'Chevrolet',
  'malibu': 'Chevrolet',
  'f-150': 'Ford',
  'f150': 'Ford',
  'f-250': 'Ford',
  'f250': 'Ford',
  'mustang': 'Ford',
  'explorer': 'Ford',
  'escape': 'Ford',
  'ranger': 'Ford',
  'bronco': 'Ford',
  'expedition': 'Ford',
  'fusion': 'Ford',
  'camry': 'Toyota',
  'corolla': 'Toyota',
  'tacoma': 'Toyota',
  '4runner': 'Toyota',
  'highlander': 'Toyota',
  'prius': 'Toyota',
  'sienna': 'Toyota',
  'tundra': 'Toyota',
  'rav4': 'Toyota',
  'civic': 'Honda',
  'accord': 'Honda',
  'cr-v': 'Honda',
  'crv': 'Honda',
  'pilot': 'Honda',
  'odyssey': 'Honda',
  'fit': 'Honda',
  'altima': 'Nissan',
  'sentra': 'Nissan',
  'rogue': 'Nissan',
  'pathfinder': 'Nissan',
  'frontier': 'Nissan',
  'maxima': 'Nissan',
  'elantra': 'Hyundai',
  'sonata': 'Hyundai',
  'santa fe': 'Hyundai',
  'tucson': 'Hyundai',
  'wrangler': 'Jeep',
  'grand cherokee': 'Jeep',
  'cherokee': 'Jeep',
  'compass': 'Jeep',
  'charger': 'Dodge',
  'challenger': 'Dodge',
  'durango': 'Dodge',
  'ram 1500': 'Ram',
  'ram 2500': 'Ram',
};

export interface VehicleHint {
  make: string;
  year: string;
  /** Raw words from the title that follow the make — used for model fuzzy matching */
  modelWords: string[];
}

export interface ManualImage {
  url: string;       // absolute URL to the image on lemon-manuals.la
  caption: string;   // surrounding text used as the figure caption
}

export interface ManualLink {
  url: string;
  label: string;
  group: 'vehicle' | 'quick-lookup' | 'section';
  icon: string; // Material Symbol name
}

export interface LemonManualsResult {
  text: string;
  images: ManualImage[];
  links: ManualLink[];
}

/**
 * Convert a 2-digit year string to a full 4-digit year.
 * 60-99 → 1960-1999, 00-26 → 2000-2026.
 */
function expandTwoDigitYear(twoDigit: string): string {
  const n = parseInt(twoDigit, 10);
  return n >= 60 ? `19${twoDigit}` : `20${twoDigit.padStart(2, '0')}`;
}

/**
 * Extract make, year, and likely model words from a video title.
 * Handles both 4-digit years ("2014") and 2-digit year ranges ("07-14").
 * When no year is found, returns the current year so the vehicle-aware
 * fetcher can still attempt navigation (it tries ±3 years anyway).
 */
export function extractVehicleHint(title: string): VehicleHint | null {
  const lower = title.toLowerCase();

  // 1. Try 4-digit year first (most common: "2022 Honda Civic")
  let year: string | undefined;
  const year4Match = lower.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  if (year4Match) {
    year = year4Match[1];
  } else {
    // 2. Fall back to 2-digit year range like "07-14" or "'98".
    // Take the first (earlier) year — fetcher tries +3 offsets anyway.
    const year2Match = lower.match(/(?:^|[\s'(])([6-9]\d|0\d|1\d|2[0-6])(?:-\d{2})?(?=\s|$)/);
    if (year2Match) {
      year = expandTwoDigitYear(year2Match[1]);
    }
  }

  // Check aliases first (longest multi-word first to avoid partial matches)
  let make: string | null = null;
  const sortedAliases = Object.entries(MAKE_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of sortedAliases) {
    if (lower.includes(alias)) { make = canonical; break; }
  }

  // Then check canonical makes (longest first to avoid "Ford" matching "Oxford")
  if (!make) {
    const sorted = [...KNOWN_MAKES].sort((a, b) => b.length - a.length);
    for (const m of sorted) {
      if (lower.includes(m.toLowerCase())) { make = m; break; }
    }
  }

  if (!make) return null;

  // If no year was found but we have a make, use the current year as a starting
  // point — fetchLemonManualsVehicle tries offsets in both directions.
  if (!year) {
    year = String(new Date().getFullYear());
  }

  // Grab model words from the full title (not just after the make) by stripping
  // known noise words and the make/year tokens themselves.
  const titleWords = title
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      const wl = w.toLowerCase();
      return (
        w.length > 1 &&
        !/^\d{4}$/.test(w) &&                     // drop 4-digit years
        !/^\d{2}$/.test(w) &&                     // drop 2-digit years
        wl !== make!.toLowerCase() &&
        !['how', 'to', 'diy', 'the', 'a', 'an', 'on', 'for', 'my', 'your',
          'fix', 'repair', 'replace', 'install', 'change', 'easy', 'quick',
          'step', 'guide', 'tutorial', 'with', 'and', 'in', 'at'].includes(wl)
      );
    })
    .slice(0, 6);

  return { make, year, modelWords: titleWords };
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
    // Skip bare index pages and non-repair pages.
    // Must NOT skip content pages which also contain "Repair%20and%20Diagnosis" in their path.
    if (/\/(Labor|Download|bundle)\//i.test(href)) continue;
    // Skip if the URL ends at exactly the index level (no sub-section after it)
    if (/Repair%20and%20Diagnosis%20%28Single%20Page%29\/?$/i.test(href)) continue;
    if (/Repair%20and%20Diagnosis\/?$/i.test(href)) continue;
    if (!seen.has(href)) { seen.add(href); links.push(href); }
  }
  return links;
}

/**
 * Extract OEM diagram image URLs and captions from a Lemon Manuals page.
 * Images live at /images25/{id}/ and are served as PNG.
 */
function extractManualImages(html: string, caption: string): ManualImage[] {
  const images: ManualImage[] = [];
  const seen = new Set<string>();

  // Match <img src="/images25/..."> or <img src="https://lemon-manuals.la/images25/...">
  const imgPattern = /src=["']((?:https?:\/\/lemon-manuals\.la)?\/images25\/[^"']+)["']/gi;
  // Also capture the nearest surrounding figure caption text
  const figPattern = /<(?:figcaption|p|td|div)[^>]*>(.*?)<\/(?:figcaption|p|td|div)>/gi;

  // Build a list of text snippets near each image for captioning
  const textSnippets: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = figPattern.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text.length > 5 && text.length < 200) textSnippets.push(text);
  }

  let imgIdx = 0;
  while ((m = imgPattern.exec(html)) !== null) {
    let url = m[1];
    if (!url.startsWith('http')) url = `${LEMON_BASE}${url}`;
    if (seen.has(url)) continue;
    seen.add(url);
    // Try to find a caption near this image index
    const figCaption = textSnippets[imgIdx] ?? caption;
    images.push({ url, caption: figCaption });
    imgIdx++;
  }

  return images;
}

// Synonym expansion: maps a keyword to related terms likely found in section slugs.
const REPAIR_SYNONYMS: Record<string, string[]> = {
  brake:      ['disc', 'caliper', 'rotor', 'drum', 'pad', 'shoe', 'brake'],
  brakes:     ['disc', 'caliper', 'rotor', 'drum', 'pad', 'shoe', 'brake'],
  caliper:    ['brake', 'disc', 'caliper'],
  rotor:      ['disc', 'rotor', 'brake'],
  pad:        ['brake', 'pad', 'disc'],
  oil:        ['engine', 'lubrication', 'drain', 'filter', 'sump', 'oil'],
  coolant:    ['cooling', 'radiator', 'thermostat', 'coolant', 'antifreeze'],
  radiator:   ['cooling', 'radiator', 'coolant'],
  thermostat: ['cooling', 'thermostat', 'coolant'],
  timing:     ['timing', 'chain', 'belt', 'tensioner', 'camshaft'],
  chain:      ['timing', 'chain', 'tensioner'],
  belt:       ['timing', 'serpentine', 'belt', 'tensioner', 'drive'],
  spark:      ['ignition', 'spark', 'plug', 'coil'],
  plug:       ['spark', 'plug', 'ignition'],
  ignition:   ['ignition', 'coil', 'spark', 'plug'],
  coil:       ['coil', 'ignition', 'spark'],
  fuel:       ['fuel', 'injector', 'pump', 'filter', 'rail'],
  injector:   ['fuel', 'injector'],
  pump:       ['fuel', 'pump', 'water', 'coolant'],
  starter:    ['starter', 'cranking', 'electrical'],
  alternator: ['alternator', 'charging', 'electrical'],
  battery:    ['battery', 'electrical', 'charging'],
  transmission: ['transmission', 'transaxle', 'gear', 'shift'],
  transfer:   ['transfer', 'case', 'drivetrain'],
  axle:       ['axle', 'shaft', 'cv', 'drivetrain'],
  suspension: ['suspension', 'strut', 'shock', 'spring', 'control', 'arm'],
  strut:      ['strut', 'suspension', 'shock', 'spring'],
  shock:      ['shock', 'strut', 'suspension'],
  bearing:    ['bearing', 'hub', 'wheel'],
  wheel:      ['wheel', 'hub', 'bearing'],
  steering:   ['steering', 'rack', 'tie', 'rod', 'column'],
  exhaust:    ['exhaust', 'manifold', 'muffler', 'catalytic'],
  catalytic:  ['catalytic', 'exhaust', 'converter'],
  oxygen:     ['oxygen', 'sensor', 'o2', 'exhaust'],
  sensor:     ['sensor'],
  valve:      ['valve', 'valvetrain', 'head', 'cover'],
  head:       ['head', 'cylinder', 'gasket', 'valve'],
  gasket:     ['gasket', 'seal', 'head'],
  seal:       ['seal', 'gasket', 'leak'],
  window:     ['window', 'regulator', 'motor', 'glass'],
  door:       ['door', 'latch', 'lock', 'hinge'],
  hvac:       ['hvac', 'air', 'conditioning', 'heater', 'blower'],
  ac:         ['air', 'conditioning', 'compressor', 'hvac'],
  heat:       ['heater', 'core', 'hvac', 'blower'],
};

/**
 * Score a section link by keyword relevance to the repair topic.
 * Expands keywords through a synonym map so e.g. "caliper" matches
 * "Front Disc Brakes" sections even though "caliper" isn't in the URL.
 */
function scoreSectionLink(url: string, keywordsLower: string[]): number {
  const decoded = decodeURIComponent(url).toLowerCase();
  let score = 0;
  for (const kw of keywordsLower) {
    // Direct match
    if (decoded.includes(kw)) { score += 2; continue; }
    // Synonym expansion
    const synonyms = REPAIR_SYNONYMS[kw] ?? [];
    for (const syn of synonyms) {
      if (decoded.includes(syn)) { score += 1; break; }
    }
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
): Promise<LemonManualsResult> {
  const empty: LemonManualsResult = { text: '', images: [], links: [] };
  try {
    // ── 1. Fetch the make/year listing to find exact model URLs ──────────
    // Try the extracted year first, then ±3 years (forward then backward)
    // so "07-14" titles that resolve to 2007 still find 2008, 2009, etc.,
    // and year-missing titles starting at current year also find nearby years.
    let resolvedYear = vehicle.year;
    let modelLinks: string[] = [];

    const baseYear = parseInt(vehicle.year, 10);
    const offsets = [0, 1, -1, 2, -2, 3, -3];
    for (const offset of offsets) {
      const tryYear = String(baseYear + offset);
      if (parseInt(tryYear, 10) < 1960 || parseInt(tryYear, 10) > new Date().getFullYear() + 1) continue;
      const tryUrl = `${LEMON_BASE}/${encodeURIComponent(vehicle.make)}/${tryYear}/`;
      try {
        const html = await fetchWithTimeout(tryUrl);
        const links = parseModelLinks(html, vehicle.make, tryYear);
        if (links.length > 0) {
          resolvedYear = tryYear;
          modelLinks = links;
          if (offset !== 0) console.log(`lemon-manuals: year ${vehicle.year} had no models, using ${tryYear}`);
          break;
        }
      } catch { /* try next year */ }
    }

    if (modelLinks.length === 0) {
      console.warn(`lemon-manuals: no model links found for ${vehicle.make} ${vehicle.year}±3`);
      return empty;
    }

    // ── 2. Pick the best-matching model URL ──────────────────────────────
    const titleLower = (vehicle.modelWords.join(' ') + ' ' + repairQuery).toLowerCase();
    const scored = modelLinks
      .map((url) => ({ url, score: scoreModelUrl(url, vehicle.modelWords, titleLower) }))
      .sort((a, b) => b.score - a.score);

    const bestModel = scored[0].url;
    console.log(`lemon-manuals: ${vehicle.make} ${resolvedYear} — matched model → ${decodeURIComponent(bestModel)} (score ${scored[0].score})`);

    // ── 3. Fetch the single-page repair index (with fallbacks) ──────────
    // Try the single-page index first; if it 404s or is empty, try the
    // regular repair index, then fall back to the bare model page.
    const indexCandidates = [
      `${bestModel}Repair%20and%20Diagnosis%20%28Single%20Page%29/`,
      `${bestModel}Repair%20and%20Diagnosis/`,
      bestModel,
    ];
    let indexHtml = '';
    let repairIndexUrl = indexCandidates[0];
    for (const candidate of indexCandidates) {
      try {
        const html = await fetchWithTimeout(candidate);
        const links = parseSectionLinks(html, bestModel);
        if (links.length > 0) {
          indexHtml = html;
          repairIndexUrl = candidate;
          if (candidate !== indexCandidates[0]) {
            console.log(`lemon-manuals: single-page index not found, using ${candidate}`);
          }
          break;
        }
      } catch { /* try next candidate */ }
    }

    if (!indexHtml) {
      console.warn(`lemon-manuals: could not load any repair index for ${bestModel}`);
      // Still surface the vehicle and index links even if we can't fetch sections
      return {
        text: '',
        images: [],
        links: [
          { url: bestModel, label: `${vehicle.make} ${resolvedYear} — Service Manual` },
          { url: indexCandidates[0], label: 'Full Repair & Diagnosis Index' },
        ],
      };
    }

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
      .slice(0, 8);  // top 8 most relevant sections

    if (rankedSections.length === 0) {
      // No keyword hits — fall back to the first few sections (common specs etc.)
      rankedSections.push(...sectionLinks.slice(0, 3).map((url) => ({ url, score: 0 })));
    }

    console.log(`lemon-manuals: fetching ${rankedSections.length} sections for "${repairQuery}"`);

    // ── 5. Fetch section pages in parallel ───────────────────────────────
    const chunkSize = Math.floor(MAX_CONTENT_CHARS / Math.max(rankedSections.length, 1));
    const allImages: ManualImage[] = [];

    const sectionTexts = await Promise.all(
      rankedSections.map(async ({ url }) => {
        try {
          const pageHtml = await fetchWithTimeout(url);
          const label = decodeURIComponent(url.replace(bestModel, '').replace(/\/$/, ''));
          // Extract images before stripping HTML
          const images = extractManualImages(pageHtml, label);
          allImages.push(...images);
          const text = extractMainText(pageHtml).slice(0, chunkSize);
          if (text.length < 80) return '';
          return `[Lemon Manuals — ${label}]\n${text}`;
        } catch {
          return '';
        }
      })
    );

    const combined = sectionTexts.filter(Boolean).join('\n\n');
    const uniqueImages = allImages.filter((img, i, arr) => arr.findIndex(x => x.url === img.url) === i);

    // Build the full set of useful links using the known URL patterns
    const bundleUrl = bestModel.replace(LEMON_BASE + '/', LEMON_BASE + '/bundle/');

    const vehicleLinks: ManualLink[] = [
      { url: bestModel,    label: `${vehicle.make} ${resolvedYear} Service Manual`, group: 'vehicle', icon: 'home_repair_service' },
      { url: repairIndexUrl, label: 'Full Repair & Diagnosis (searchable)', group: 'vehicle', icon: 'list' },
      { url: `${bestModel}Labor%20Times/`, label: 'Labor Times', group: 'vehicle', icon: 'schedule' },
      { url: bundleUrl, label: 'Download Offline ZIP', group: 'vehicle', icon: 'download' },
    ];

    const quickLookupLinks: ManualLink[] = [
      { url: `${bestModel}Repair%20and%20Diagnosis/Quick%20Lookups/Fluids/`, label: 'Fluids & Capacities', group: 'quick-lookup', icon: 'water_drop' },
      { url: `${bestModel}Repair%20and%20Diagnosis/Quick%20Lookups/DTC%20Index/`, label: 'DTC / Trouble Codes', group: 'quick-lookup', icon: 'error_outline' },
      { url: `${bestModel}Repair%20and%20Diagnosis/Quick%20Lookups/Wiring%20Diagrams/System%20Wiring%20Diagrams/`, label: 'Wiring Diagrams', group: 'quick-lookup', icon: 'cable' },
      { url: `${bestModel}Repair%20and%20Diagnosis/Quick%20Lookups/Technical%20Bulletins/Technical%20Service%20Bulletins/`, label: 'TSBs', group: 'quick-lookup', icon: 'campaign' },
      { url: `${bestModel}Repair%20and%20Diagnosis/Quick%20Lookups/Technical%20Bulletins/Safety%20Recalls/`, label: 'Safety Recalls', group: 'quick-lookup', icon: 'warning' },
    ];

    function sectionLabel(url: string): string {
      const decoded = decodeURIComponent(url.replace(bestModel, '').replace(/\/$/, ''));
      const parts = decoded.split('/').filter(Boolean);
      return parts[parts.length - 1] ?? decoded;
    }

    const sectionManualLinks: ManualLink[] = rankedSections.map(({ url }) => ({
      url,
      label: sectionLabel(url),
      group: 'section' as const,
      icon: 'article',
    }));

    const manualLinks: ManualLink[] = [...vehicleLinks, ...quickLookupLinks, ...sectionManualLinks];

    console.log(`lemon-manuals: ${combined.length} chars + ${uniqueImages.length} diagrams + ${manualLinks.length} links for ${vehicle.make} ${resolvedYear}`);

    return {
      text: combined.slice(0, MAX_CONTENT_CHARS * 2),
      images: uniqueImages.slice(0, 12),
      links: manualLinks,
    };

  } catch (err) {
    console.warn('lemon-manuals vehicle fetch skipped:', err instanceof Error ? err.message : err);
    return empty;
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
 * Returns a full LemonManualsResult so links surface in the UI sidebar.
 */
export async function fetchLemonManuals(query: string): Promise<LemonManualsResult> {
  const empty: LemonManualsResult = { text: '', images: [], links: [] };
  try {
    const homeHtml = await fetchWithTimeout(LEMON_BASE).catch(() => '');
    const searchBase = homeHtml ? detectSearchUrl(LEMON_BASE, homeHtml) : `${LEMON_BASE}/?s=`;

    const searchUrl = `${searchBase}${encodeURIComponent(query)}`;
    const searchHtml = await fetchWithTimeout(searchUrl);

    const linkPattern = /href=["'](https?:\/\/lemon-manuals\.la\/[^"'#?]+)["']/gi;
    const foundLinks: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkPattern.exec(searchHtml)) !== null && foundLinks.length < 4) {
      const href = m[1];
      if (/\/(category|tag|page|author|feed)\//i.test(href)) continue;
      if (!foundLinks.includes(href)) foundLinks.push(href);
    }

    const chunks: string[] = [];
    const manualLinks: ManualLink[] = [];

    const searchText = extractMainText(searchHtml).slice(0, MAX_CONTENT_CHARS / 2);
    if (searchText.length > 100) chunks.push(`[lemon-manuals.la search results]\n${searchText}`);

    for (const link of foundLinks.slice(0, 3)) {
      try {
        const pageHtml = await fetchWithTimeout(link);
        const text = extractMainText(pageHtml).slice(0, MAX_CONTENT_CHARS / 2);
        if (text.length > 100) {
          chunks.push(`[lemon-manuals.la: ${link}]\n${text}`);
          // Derive a readable label from the URL path
          const pathLabel = decodeURIComponent(link.replace(LEMON_BASE, '').replace(/^\/|\/$/g, '').replace(/\//g, ' › '));
          manualLinks.push({ url: link, label: pathLabel || link });
        }
      } catch {
        // ignore individual page fetch failures
      }
    }

    if (chunks.length === 0) return empty;
    console.log(`lemon-manuals.la search: ${chunks.join('').length} chars, ${manualLinks.length} links for "${query}"`);
    return {
      text: chunks.join('\n\n').slice(0, MAX_CONTENT_CHARS),
      images: [],
      links: manualLinks,
    };
  } catch (err) {
    console.warn('lemon-manuals.la fetch skipped:', err instanceof Error ? err.message : err);
    return empty;
  }
}
