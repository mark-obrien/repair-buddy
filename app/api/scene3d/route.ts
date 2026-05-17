import { NextRequest, NextResponse } from 'next/server';
import { generateScene3D, type SceneGuideContext } from '@/lib/scene-generator';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { frames, oemDiagrams, guide, provider, model } = body as {
      frames: string[];
      oemDiagrams?: Array<{ src: string; caption: string }>;
      guide: SceneGuideContext;
      provider?: string;
      model?: string;
    };

    if (!Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json({ error: 'frames array is required' }, { status: 400 });
    }
    if (!guide?.videoTitle) {
      return NextResponse.json({ error: 'guide context is required' }, { status: 400 });
    }

    const scene = await generateScene3D(
      frames,
      guide,
      provider ?? 'anthropic',
      model ?? 'claude-sonnet-4-6',
      oemDiagrams ?? [],
    );

    return NextResponse.json({ scene });
  } catch (err) {
    console.error('Scene3D error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scene generation failed' },
      { status: 500 }
    );
  }
}
