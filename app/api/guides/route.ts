import { NextResponse } from 'next/server';
import { getAllCachedGuides } from '@/lib/cache';
import { extractVideoId } from '@/lib/youtube';

export async function GET() {
  try {
    const guides = await getAllCachedGuides();
    
    // We only need metadata for the library view, don't send heavy arrays like frames or full steps
    const libraryGuides = guides.map(g => ({
      videoId: extractVideoId(g.guide.videoUrl) || 'unknown',
      provider: g.provider,
      model: g.model,
      cachedAt: g.cachedAt,
      title: g.guide.videoTitle,
      thumbnailUrl: g.guide.thumbnailUrl,
      difficulty: g.guide.difficulty,
      summary: g.guide.summary,
      vehicleApplicability: g.guide.vehicleInfo?.applicability || 'Universal',
    }));

    return NextResponse.json({ guides: libraryGuides });
  } catch (error) {
    console.error('Error fetching guide library:', error);
    return NextResponse.json({ error: 'Failed to fetch guide library' }, { status: 500 });
  }
}
