import { YoutubeTranscript } from 'youtube-transcript';
import { transcribeWithWhisper, SpeechToTextError } from './speech-to-text';
import { getCachedTranscript, cacheTranscript } from './cache';

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

export interface TranscriptResult {
  text: string;
  durationSeconds: number;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTranscript(items: Array<{ text: string; offset: number }>): TranscriptResult {
  if (items.length === 0) return { text: '', durationSeconds: 0 };

  const chunks: string[] = [];
  let currentChunkText: string[] = [];
  let currentChunkStart = items[0].offset;
  const CHUNK_SECONDS = 10;

  for (const item of items) {
    if (item.offset - currentChunkStart >= CHUNK_SECONDS && currentChunkText.length > 0) {
      chunks.push(`[${formatTimestamp(currentChunkStart)}] ${currentChunkText.join(' ')}`);
      currentChunkText = [];
      currentChunkStart = item.offset;
    }
    currentChunkText.push(item.text.replace(/\s+/g, ' ').trim());
  }

  if (currentChunkText.length > 0) {
    chunks.push(`[${formatTimestamp(currentChunkStart)}] ${currentChunkText.join(' ')}`);
  }

  const last = items[items.length - 1];
  return {
    text: chunks.join('\n\n'),
    durationSeconds: Math.ceil(last.offset),
  };
}

async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptResult> {
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    if (!items || items.length === 0) {
      throw new TranscriptUnavailableError('Transcript is empty.');
    }
    return formatTranscript(items.map((i) => ({ text: i.text, offset: i.offset })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')) {
      throw new TranscriptRateLimitError('YouTube is rate-limiting transcript requests. Please try again in a few minutes.');
    }
    if (msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('unavailable') ||
        msg.toLowerCase().includes('no transcript') || msg.toLowerCase().includes('captions')) {
      throw new TranscriptUnavailableError(msg);
    }
    throw new TranscriptUnavailableError(`Failed to fetch transcript: ${msg}`);
  }
}

export async function fetchAndFormatTranscript(videoId: string): Promise<TranscriptResult> {
  const cached = await getCachedTranscript(videoId);
  if (cached) {
    // Try to recover the duration from the last timestamp marker
    const matches = [...cached.matchAll(/\[(\d+):(\d+)\]/g)];
    const lastMatch = matches[matches.length - 1];
    const durationSeconds = lastMatch
      ? parseInt(lastMatch[1], 10) * 60 + parseInt(lastMatch[2], 10) + 30
      : 0;
    return { text: cached, durationSeconds };
  }

  let result: TranscriptResult;
  try {
    result = await fetchYoutubeTranscript(videoId);
  } catch (err) {
    if (err instanceof TranscriptRateLimitError) throw err;
    if (err instanceof TranscriptUnavailableError) {
      // Try Whisper fallback
      try {
        result = await transcribeWithWhisper(videoId);
      } catch (whisperErr) {
        if (whisperErr instanceof SpeechToTextError) throw whisperErr;
        throw new TranscriptUnavailableError(
          'No captions available and Whisper transcription failed. Try a different video.'
        );
      }
    } else {
      throw err;
    }
  }

  await cacheTranscript(videoId, result.text);
  return result;
}
