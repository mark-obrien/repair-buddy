/**
 * Functions for browsing lemon-manuals.la in the manuals section.
 * Separate from web-sources.ts (which is optimised for guide generation).
 * All functions return empty/null on failure — never throw.
 */

const LEMON_BASE = 'https://lemon-manuals.la';
const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function lget(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: ctrl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

function plain(html: string): string {
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

function absolute(href: string): string {
  if (href.startsWith('/') && !href.startsWith('//')) return LEMON_BASE + href;
  return href;
}

function withSlash(url: string): string {
  return url.endsWith('/') ? url : url + '/';
}

export interface YearLink  { year: string; url: string }
export interface ModelLink { name: string; url: string }
export interface SectionLink { name: string; url: string; depth: number }
export interface PageContent {
  title: string;
  text: string;
  images: Array<{ url: string; alt: string }>;
  subSections: Array<{ name: string; url: string }>;
}

// ---------------------------------------------------------------------------
// Make → list of years
// ---------------------------------------------------------------------------

export async function fetchMakeYears(make: string): Promise<YearLink[]> {
  try {
    const url = `${LEMON_BASE}/${encodeURIComponent(make)}/`;
    const html = await lget(url);
    const pattern = /href=["']([^"']+)["']/gi;
    const years = new Map<string, string>();
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      const href = withSlash(absolute(m[1]));
      if (!href.startsWith(LEMON_BASE)) continue;
      const path = href.slice(LEMON_BASE.length).replace(/^\/|\/$/g, '');
      const segs = path.split('/');
      if (segs.length === 2 && /^\d{4}$/.test(segs[1])) {
        if (!years.has(segs[1])) years.set(segs[1], href);
      }
    }
    return [...years.entries()]
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, url]) => ({ year, url }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Make + Year → list of model variants
// ---------------------------------------------------------------------------

export async function fetchYearModels(make: string, year: string): Promise<ModelLink[]> {
  try {
    const url = `${LEMON_BASE}/${encodeURIComponent(make)}/${year}/`;
    const html = await lget(url);
    const pattern = /href=["']([^"']+)["']/gi;
    const models: ModelLink[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      const href = withSlash(absolute(m[1]));
      if (!href.startsWith(LEMON_BASE)) continue;
      const path = href.slice(LEMON_BASE.length).replace(/^\/|\/$/g, '');
      const segs = path.split('/');
      if (segs.length !== 3) continue;
      if (decodeURIComponent(segs[0]).toLowerCase() !== make.toLowerCase()) continue;
      if (segs[1] !== year) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      models.push({ name: decodeURIComponent(segs[2]), url: href });
    }
    return models;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Model URL → list of repair sections
// ---------------------------------------------------------------------------

function extractSectionLinks(html: string, vehicleBaseUrl: string): SectionLink[] {
  const seen = new Set<string>();
  const items: SectionLink[] = [];
  const pattern = /href=["']([^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const url = withSlash(absolute(m[1]));
    if (!url.startsWith(vehicleBaseUrl)) continue;
    if (url === vehicleBaseUrl) continue;
    if (/\/(Labor|Download|bundle)\//i.test(url)) continue;
    if (/Repair%20and%20Diagnosis%20%28Single%20Page%29\/?$/i.test(url)) continue;
    if (/Repair%20and%20Diagnosis\/?$/i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const relative = decodeURIComponent(url.replace(vehicleBaseUrl, '').replace(/\/$/, ''));
    const parts = relative.split('/').filter(Boolean);
    items.push({ name: parts[parts.length - 1] ?? '', url, depth: parts.length });
  }
  return items;
}

export async function fetchModelSections(vehicleUrl: string): Promise<SectionLink[]> {
  const candidates = [
    `${vehicleUrl}Repair%20and%20Diagnosis%20%28Single%20Page%29/`,
    `${vehicleUrl}Repair%20and%20Diagnosis/`,
    vehicleUrl,
  ];
  for (const candidate of candidates) {
    try {
      const html = await lget(candidate);
      const links = extractSectionLinks(html, vehicleUrl);
      if (links.length > 0) return links;
    } catch { /* try next */ }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Arbitrary page URL → content + images
// ---------------------------------------------------------------------------

export async function fetchPageContent(url: string): Promise<PageContent> {
  try {
    const html = await lget(url);

    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = plain(h1Match?.[1] ?? titleMatch?.[1] ?? '')
      .replace(/ [|–].+$/, '')
      .trim();

    // OEM diagram images
    const images: Array<{ url: string; alt: string }> = [];
    const seenImg = new Set<string>();
    const imgPat = /src=["']((?:https?:\/\/lemon-manuals\.la)?\/images25\/[^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;
    let m: RegExpExecArray | null;
    while ((m = imgPat.exec(html)) !== null) {
      const imgUrl = m[1].startsWith('http') ? m[1] : LEMON_BASE + m[1];
      if (!seenImg.has(imgUrl)) {
        seenImg.add(imgUrl);
        images.push({ url: imgUrl, alt: m[2] ?? title });
      }
    }

    // Sub-section links (links that go deeper than the current URL)
    const subSections: Array<{ name: string; url: string }> = [];
    const seenSub = new Set<string>();
    const subPat = /href=["']([^"'#?]+)["'][^>]*>\s*([^<]{1,80})\s*</gi;
    while ((m = subPat.exec(html)) !== null) {
      const href = withSlash(absolute(m[1]));
      if (!href.startsWith(url)) continue;
      if (href === url) continue;
      if (/\/(Labor|Download|bundle)\//i.test(href)) continue;
      if (seenSub.has(href)) continue;
      seenSub.add(href);
      const label = plain(m[2]).trim();
      if (label) subSections.push({ name: label, url: href });
    }

    const mainMatch = html.match(/<main[\s\S]*?<\/main>/i)
      ?? html.match(/<article[\s\S]*?<\/article>/i);
    const text = plain(mainMatch ? mainMatch[0] : html).slice(0, 10_000);

    return { title, text, images, subSections };
  } catch {
    return { title: '', text: '', images: [], subSections: [] };
  }
}

// ---------------------------------------------------------------------------
// Reconstruct a lemon-manuals.la URL from an array of decoded path segments
// ---------------------------------------------------------------------------

export function buildLemonUrl(segments: string[]): string {
  return `${LEMON_BASE}/${segments.map(encodeURIComponent).join('/')}/`;
}

export { LEMON_BASE };
