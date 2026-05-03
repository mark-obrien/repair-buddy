// Fetches top YouTube comments for a video as additional context for guide generation.
// Requires YOUTUBE_API_KEY env var. Silently no-ops if not configured — comments are
// nice-to-have, not load-bearing.

const MAX_COMMENTS = 15;
const MIN_LIKES_THRESHOLD = 2;
const MAX_COMMENT_CHARS = 600;

interface CommentItem {
  text: string;
  likes: number;
  author?: string;
}

interface YouTubeCommentSnippet {
  topLevelComment?: {
    snippet?: {
      textDisplay?: string;
      textOriginal?: string;
      likeCount?: number;
      authorDisplayName?: string;
    };
  };
}

interface YouTubeCommentsResponse {
  items?: Array<{ snippet?: YouTubeCommentSnippet }>;
  error?: { message?: string };
}

// Looks like real repair feedback — filters out "great video, thanks!" noise
const RELEVANT_KEYWORDS = [
  'tip', 'mistake', 'wrong', 'actually', 'careful', 'warn', 'note',
  'mine', 'didn\'t', 'doesn\'t', 'don\'t forget', 'pro tip',
  'torque', 'spec', 'part number', 'model', 'year', 'works on',
  'broke', 'snapped', 'stripped', 'leak', 'failed',
  'easier', 'better', 'instead', 'alternative',
];

function isLikelyRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEVANT_KEYWORDS.some((kw) => lower.includes(kw));
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchTopComments(videoId: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return '';

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('textFormat', 'plainText');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), {
      // 10s timeout via AbortController — comments are non-critical
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // 403 = comments disabled or quota exceeded; both are silent skips
      console.warn(`YouTube comments API returned ${res.status} — skipping comments`);
      return '';
    }

    const data: YouTubeCommentsResponse = await res.json();
    if (data.error) {
      console.warn('YouTube comments API error:', data.error.message);
      return '';
    }

    const raw: CommentItem[] = [];
    for (const item of data.items ?? []) {
      const snippet = item.snippet?.topLevelComment?.snippet;
      if (!snippet) continue;
      const text = stripHtml(snippet.textOriginal ?? snippet.textDisplay ?? '');
      const likes = snippet.likeCount ?? 0;
      if (!text) continue;
      raw.push({ text, likes, author: snippet.authorDisplayName });
    }

    // Keep comments that meet the like threshold OR contain repair-relevant keywords.
    // This catches both popular comments AND lower-engagement-but-substantive ones.
    const filtered = raw
      .filter((c) => c.likes >= MIN_LIKES_THRESHOLD || isLikelyRelevant(c.text))
      .filter((c) => c.text.length > 30 && c.text.length < MAX_COMMENT_CHARS)
      .slice(0, MAX_COMMENTS);

    if (filtered.length === 0) return '';

    return filtered
      .map((c, i) => `${i + 1}. [${c.likes} 👍] ${c.text}`)
      .join('\n');
  } catch (err) {
    console.warn('Failed to fetch YouTube comments:', err instanceof Error ? err.message : err);
    return '';
  }
}
