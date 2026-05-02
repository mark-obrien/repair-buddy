import { NextResponse } from 'next/server';
import { extractVideoId, getVideoMetadata } from '@/lib/youtube';
import {
  fetchAndFormatTranscript,
  TranscriptUnavailableError,
  TranscriptRateLimitError,
  SpeechToTextError,
} from '@/lib/transcript';
import { extractVideoFrames, FrameExtractionError } from '@/lib/frames';
import { generateRepairGuide } from '@/lib/guide-generator';
import { researchRepairTopic } from '@/lib/researcher';
import { checkProviderKey, DEFAULT_PROVIDER, DEFAULT_MODEL, getModelOption } from '@/lib/providers';

export const maxDuration = 60;
export const runtime = 'nodejs';

const FRAME_TIMEOUT_MS = 25_000;

async function tryExtractFrames(videoUrl: string, durationSeconds: number): Promise<string[]> {
  try {
    const result = await Promise.race([
      extractVideoFrames(videoUrl, durationSeconds),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Frame extraction budget exceeded')), FRAME_TIMEOUT_MS)
      ),
    ]);
    console.log(`Extracted ${result.frames.length} frames`);
    return result.frames;
  } catch (err) {
    const reason = err instanceof FrameExtractionError || err instanceof Error ? err.message : 'unknown';
    console.warn(`Frame extraction skipped: ${reason}`);
    return [];
  }
}

export async function POST(request: Request) {
  let body: { url?: string; provider?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { url, provider = DEFAULT_PROVIDER, model = DEFAULT_MODEL } = body;

  if (!url?.trim()) {
    return NextResponse.json({ error: 'A YouTube URL is required.' }, { status: 400 });
  }

  // Validate provider key is configured
  const keyError = checkProviderKey(provider);
  if (keyError) {
    return NextResponse.json({ error: keyError }, { status: 400 });
  }

  const videoId = extractVideoId(url.trim());
  if (!videoId) {
    return NextResponse.json(
      { error: 'Could not find a valid YouTube video ID in that URL.' },
      { status: 400 }
    );
  }

  // Fetch metadata and transcript
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
    if (err instanceof TranscriptUnavailableError || err instanceof SpeechToTextError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('YouTube fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch video data. Please try again.' }, { status: 500 });
  }

  // Determine if selected model supports vision
  const modelOption = getModelOption(provider, model);
  const useFrames = modelOption?.supportsVision !== false;

  // Run research + frame extraction in parallel (both non-fatal)
  const [researchContext, frames] = await Promise.all([
    researchRepairTopic(metadata.title, provider, model),
    useFrames ? tryExtractFrames(url.trim(), durationSeconds) : Promise.resolve([]),
  ]);

  if (researchContext) {
    console.log(`Research context generated (${researchContext.length} chars)`);
  }

  try {
    const guide = await generateRepairGuide(
      transcriptText,
      metadata.title,
      url.trim(),
      metadata.thumbnailUrl,
      frames,
      researchContext,
      provider,
      model
    );
    return NextResponse.json({
      guide,
      framesAnalyzed: frames.length,
      researchPerformed: researchContext.length > 0,
      provider,
      model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('Guide generation error:', msg);

    if (msg.includes('API key') || msg.includes('401') || msg.includes('Unauthorized')) {
      return NextResponse.json(
        { error: `API key error for ${provider}. Check your .env.local configuration.` },
        { status: 500 }
      );
    }
    if (msg.includes('overloaded') || msg.includes('529') || msg.includes('503')) {
      return NextResponse.json(
        { error: 'AI service is temporarily overloaded. Please try again.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: `Failed to generate repair guide: ${msg}` },
      { status: 500 }
    );
  }
}
