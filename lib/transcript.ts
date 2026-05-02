import { YoutubeTranscript, YoutubeTranscriptError } from 'youtube-transcript';

const MAX_CHARS = 80_000;

export interface TranscriptResult {
  text: string;
  durationSeconds: number;
}

export async function fetchAndFormatTranscript(videoId: string): Promise<TranscriptResult> {
  let items;
  try {
    items = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (err) {
    if (err instanceof YoutubeTranscriptError) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('disabled') || msg.includes('no captions')) {
        throw new TranscriptUnavailableError(
          'This video does not have captions or a transcript available.'
        );
      }
      if (msg.includes('unavailable') || msg.includes('private')) {
        throw new TranscriptUnavailableError('This video is unavailable or private.');
      }
      if (msg.includes('Too Many Requests') || msg.includes('429')) {
        throw new TranscriptRateLimitError('YouTube rate limited the request — please try again shortly.');
      }
      throw new TranscriptUnavailableError(
        'Could not fetch the transcript for this video.'
      );
    }
    throw err;
  }

  // Estimate video duration from last transcript item's offset + duration
  const lastItem = items[items.length - 1];
  const durationSeconds = lastItem
    ? Math.ceil((lastItem.offset + lastItem.duration) / 1000)
    : 0;

  const full = items.map((item) => item.text).join(' ');
  const trimmed = full.length > MAX_CHARS
    ? full.slice(0, full.lastIndexOf(' ', MAX_CHARS) || MAX_CHARS)
    : full;

  return { text: trimmed, durationSeconds };
}

export class TranscriptUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptUnavailableError';
  }
}

export class TranscriptRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptRateLimitError';
  }
}
