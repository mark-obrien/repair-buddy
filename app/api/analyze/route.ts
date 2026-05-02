import { NextResponse } from 'next/server';
import { extractVideoId, getVideoMetadata } from '@/lib/youtube';
import {
  fetchAndFormatTranscript,
  TranscriptUnavailableError,
  TranscriptRateLimitError,
} from '@/lib/transcript';
import { extractVideoFrames, FrameExtractionError } from '@/lib/frames';
import { generateRepairGuide } from '@/lib/claude';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;
export const runtime = 'nodejs';

// 25-second budget for frame extraction — falls back gracefully if exceeded
const FRAME_TIMEOUT_MS = 25_000;

async function tryExtractFrames(videoUrl: string, durationSeconds: number): Promise<string[]> {
  try {
    const result = await Promise.race([
      extractVideoFrames(videoUrl, durationSeconds),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Frame extraction budget exceeded')), FRAME_TIMEOUT_MS)
      ),
    ]);
    console.log(`Extracted ${result.frames.length} frames from video`);
    return result.frames;
  } catch (err) {
    // Non-fatal — log and continue without frames
    const reason = err instanceof FrameExtractionError || err instanceof Error
      ? err.message
      : 'unknown';
    console.warn(`Frame extraction skipped: ${reason}`);
    return [];
  }
}

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { url } = body;
  if (!url?.trim()) {
    return NextResponse.json({ error: 'A YouTube URL is required.' }, { status: 400 });
  }

  const videoId = extractVideoId(url.trim());
  if (!videoId) {
    return NextResponse.json(
      { error: 'Could not find a valid YouTube video ID in that URL.' },
      { status: 400 }
    );
  }

  // Fetch metadata and transcript in parallel
  let metadata: { title: string; thumbnailUrl: string };
  let transcriptText: string;
  let durationSeconds: number;

  try {
    const [meta, transcriptResult] = await Promise.all([
      getVideoMetadata(videoId),
      fetchAndFormatTranscript(videoId),
    ]);
    metadata = meta;
    transcriptText = transcriptResult.text;
    durationSeconds = transcriptResult.durationSeconds;
  } catch (err) {
    if (err instanceof TranscriptRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof TranscriptUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('YouTube fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch video data. Please try again.' },
      { status: 500 }
    );
  }

  // Attempt frame extraction — non-fatal if it fails
  const frames = await tryExtractFrames(url.trim(), durationSeconds);

  try {
    const guide = await generateRepairGuide(
      transcriptText,
      metadata.title,
      url.trim(),
      metadata.thumbnailUrl,
      frames
    );
    return NextResponse.json({ guide, framesAnalyzed: frames.length });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      if (err.status === 401) {
        return NextResponse.json(
          { error: 'API key configuration error. Please check ANTHROPIC_API_KEY.' },
          { status: 500 }
        );
      }
      if (err.status === 529 || err.status === 503) {
        return NextResponse.json(
          { error: 'AI service is temporarily overloaded. Please try again in a moment.' },
          { status: 503 }
        );
      }
    }
    console.error('Claude error:', err);
    return NextResponse.json(
      { error: 'Failed to generate repair guide. Please try again.' },
      { status: 500 }
    );
  }
}
