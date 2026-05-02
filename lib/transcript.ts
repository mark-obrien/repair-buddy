import { YoutubeTranscript, YoutubeTranscriptError } from 'youtube-transcript';

const MAX_CHARS = 80_000;

export async function fetchAndFormatTranscript(videoId: string): Promise<string> {
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

  const full = items.map((item) => item.text).join(' ');

  if (full.length <= MAX_CHARS) return full;

  const trimmed = full.slice(0, MAX_CHARS);
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
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
