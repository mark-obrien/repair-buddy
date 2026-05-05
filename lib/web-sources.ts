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

const FETCH_TIMEOUT_MS = 8_000;
const MAX_CONTENT_CHARS = 4_000;

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Strip HTML tags and collapse whitespace, returning plain text. */
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

/** Extract the <main> or <article> text from HTML, falling back to <body>. */
function extractMainText(html: string): string {
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i)
    ?? html.match(/<article[\s\S]*?<\/article>/i)
    ?? html.match(/<div[^>]+(?:class|id)="[^"]*(?:content|main|article)[^"]*"[\s\S]*?<\/div>/i);
  return stripHtml(mainMatch ? mainMatch[0] : html);
}

/** Detect the search URL pattern from homepage HTML. */
function detectSearchUrl(baseUrl: string, html: string): string {
  // Look for <form> with action pointing to search
  const formMatch = html.match(/<form[^>]+action=["']([^"']*search[^"']*)["']/i);
  if (formMatch) {
    const action = formMatch[1].startsWith('http') ? formMatch[1] : `${baseUrl}${formMatch[1]}`;
    // Try to detect the query param name
    const paramMatch = html.match(/<input[^>]+name=["'](s|q|query|search)["'][^>]*>/i);
    const param = paramMatch ? paramMatch[1] : 'q';
    return `${action}?${param}=`;
  }
  // WordPress default
  return `${baseUrl}/?s=`;
}

/**
 * Fetch and return text content from lemon-manuals.la relevant to the repair query.
 * Returns empty string on any error so it never blocks guide generation.
 */
export async function fetchLemonManuals(query: string): Promise<string> {
  const BASE = 'https://lemon-manuals.la';
  try {
    // 1. Fetch homepage to detect search pattern
    const homeHtml = await fetchWithTimeout(BASE).catch(() => '');
    const searchBase = homeHtml ? detectSearchUrl(BASE, homeHtml) : `${BASE}/?s=`;

    // 2. Search for the query
    const searchUrl = `${searchBase}${encodeURIComponent(query)}`;
    const searchHtml = await fetchWithTimeout(searchUrl);

    // 3. Look for links to individual manual/result pages in the search results
    const linkPattern = /href=["'](https?:\/\/lemon-manuals\.la\/[^"'#?]+)["']/gi;
    const links: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkPattern.exec(searchHtml)) !== null && links.length < 3) {
      const href = m[1];
      // Skip category/tag/page index URLs
      if (/\/(category|tag|page|author|feed)\//i.test(href)) continue;
      if (!links.includes(href)) links.push(href);
    }

    const chunks: string[] = [];

    // 4a. Extract text from the search result page itself
    const searchText = extractMainText(searchHtml).slice(0, MAX_CONTENT_CHARS / 2);
    if (searchText.length > 100) chunks.push(`[lemon-manuals.la search results]\n${searchText}`);

    // 4b. Fetch and extract text from up to 2 individual pages
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
    return chunks.join('\n\n').slice(0, MAX_CONTENT_CHARS);
  } catch (err) {
    console.warn('lemon-manuals.la fetch skipped:', err instanceof Error ? err.message : err);
    return '';
  }
}
