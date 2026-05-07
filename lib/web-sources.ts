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

/**
 * Fetch repair guides from iFixit's public API.
 * Searches for the query, fetches the top 2 matching guides, and returns
 * a formatted summary of steps, tools, and parts.
 * Returns empty string on any error.
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

/**
 * Fetch and return text content from lemon-manuals.la relevant to the repair query.
 * Returns empty string on any error so it never blocks guide generation.
 */
export async function fetchLemonManuals(query: string): Promise<string> {
  const BASE = 'https://lemon-manuals.la';
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
    console.log(`lemon-manuals.la: ${chunks.join('').length} chars fetched for "${query}"`);
    return chunks.join('\n\n').slice(0, MAX_CONTENT_CHARS);
  } catch (err) {
    console.warn('lemon-manuals.la fetch skipped:', err instanceof Error ? err.message : err);
    return '';
  }
}
