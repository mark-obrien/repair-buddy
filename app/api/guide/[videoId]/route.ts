import { NextResponse } from 'next/server';
import { getCachedGuide } from '@/lib/db';
import { DEFAULT_PROVIDER, DEFAULT_MODEL, getProviderConfig } from '@/lib/providers';

export const runtime = 'nodejs';

interface Params {
  params: { videoId: string };
}

export async function GET(request: Request, { params }: Params) {
  const { videoId } = params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') ?? DEFAULT_PROVIDER;
  const model = url.searchParams.get('model') ?? DEFAULT_MODEL;

  if (!getProviderConfig(provider)) {
    return NextResponse.json({ error: 'Unknown provider.' }, { status: 400 });
  }

  const cached = await getCachedGuide(videoId, provider, model);
  if (!cached) {
    return NextResponse.json(
      { error: 'No cached guide found for this video and model. The link may have expired.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    guide: cached.guide,
    framesAnalyzed: cached.framesAnalyzed,
    researchPerformed: cached.researchPerformed,
    commentsAnalyzed: cached.commentsAnalyzed ?? 0,
    provider: cached.provider,
    model: cached.model,
    frames: cached.frames ?? [],
    cachedAt: cached.cachedAt,
    fromCache: true,
  });
}
