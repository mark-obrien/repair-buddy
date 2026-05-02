import { YoutubeTranscript, YoutubeTranscriptError } from 'youtube-transcript';
import { getCachedTranscript, cacheTranscript } from './cache';
import { transcribeSpeech, SpeechToTextError } from './speech-to-text';

const MAX_CHARS = 80_000;

export interface TranscriptResult {
  text: string;
  durationSeconds: number;
  source: 'captions' | 'speech-to-text' | 'cache';
}

export async function fetchAndFormatTranscript(videoId: string): Promise<TranscriptResult> {
  // Check cache first
  const cached = await getCachedTranscript(videoId);
  if (cached) {
    return JSON.parse(cached);
  }

  let result: TranscriptResult;

  // Try YouTube captions first
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    const lastItem = items[items.length - 1];
    const durationSeconds = lastItem
      ? Math.ceil((lastItem.offset + lastItem.duration) / 1000)
      : 0;

    const full = items.map((item) => item.text).join(' ');
    const trimmed = full.length > MAX_CHARS
      ? full.slice(0, full.lastIndexOf(' ', MAX_CHARS) || MAX_CHARS)
      : full;

    result = { text: trimmed, durationSeconds, source: 'captions' };
    console.log(`✓ Captions fetched for ${videoId}`);
  } catch (err) {
    if (err instanceof YoutubeTranscriptError) {
      const msg = (err as Error).message ?? '';
      
      // If no captions, try speech-to-text
      if (msg.includes('disabled') || msg.includes('no captions')) {
        console.log(`⚠ No captions, attempting speech-to-text for ${videoId}...`);
        try {
          const speechResult = await transcribeSpeech(`https://www.youtube.com/watch?v=${videoId}`);
          const trimmed = speechResult.text.length > MAX_CHARS
            ? speechResult.text.slice(0, speechResult.text.lastIndexOf(' ', MAX_CHARS) || MAX_CHARS)
            : speechResult.text;
          
          result = { text: trimmed, durationSeconds: speechResult.durationSeconds, source: 'speech-to-text' };
          console.log(`✓ Speech-to-text succeeded for ${videoId}`);
        } catch (speechErr) {
          throw speechErr instanceof SpeechToTextError
            ? speechErr
            : new SpeechToTextError('Speech-to-text transcription failed');
        }
      } else if (msg.includes('unavailable') || msg.includes('private')) {
        throw new TranscriptUnavailableError('This video is unavailable or private.');
      } else if (msg.includes('Too Many Requests') || msg.includes('429')) {
        throw new TranscriptRateLimitError('YouTube rate limited the request — please try again shortly.');
      } else {
        throw new TranscriptUnavailableError('Could not fetch the transcript for this video.');
      }
    } else {
      throw err;
    }
  }

  // Cache the result
  await cacheTranscript(videoId, JSON.stringify(result));
  return result;
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

export { SpeechToTextError };
