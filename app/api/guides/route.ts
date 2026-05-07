import { NextResponse } from 'next/server';
import { getAllGuides } from '@/lib/db';
import { extractVideoId } from '@/lib/youtube';

export async function GET() {
  try {
    const guides = await getAllGuides();
    
    const libraryGuides = guides.map((g) => ({
      videoId: extractVideoId(g.guide.videoUrl) || 'unknown',
      provider: g.provider,
      model: g.model,
      cachedAt: g.cachedAt,
      title: g.guide.videoTitle,
      thumbnailUrl: g.guide.thumbnailUrl,
      difficulty: g.guide.difficulty,
      summary: g.guide.summary,
      vehicleApplicability: g.guide.vehicleInfo?.applicability || 'Universal',
      category: g.guide.category,
    }));

    return NextResponse.json({ guides: libraryGuides });
  } catch (error) {
    console.error('Error fetching guide library:', error);
    return NextResponse.json({ error: 'Failed to fetch guide library' }, { status: 500 });
  }
}
