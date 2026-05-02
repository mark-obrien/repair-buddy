import { NextResponse } from 'next/server';
import { extractVideoId, getVideoMetadata } from '@/lib/youtube';
import {
  fetchAndFormatTranscript,
  TranscriptUnavailableError,
  TranscriptRateLimitError,
} from '@/lib/transcript';
import { generateRepairGuide } from '@/lib/claude';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;
export const runtime = 'nodejs';

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

  let metadata: { title: string; thumbnailUrl: string };
  let transcript: string;

  try {
    [metadata, transcript] = await Promise.all([
      getVideoMetadata(videoId),
      fetchAndFormatTranscript(videoId),
    ]);
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

  try {
    const guide = await generateRepairGuide(
      transcript,
      metadata.title,
      url.trim(),
      metadata.thumbnailUrl
    );
    return NextResponse.json({ guide });
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
