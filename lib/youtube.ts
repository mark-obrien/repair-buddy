const VIDEO_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractVideoId(url: string): string | null {
  const match = url.match(VIDEO_ID_REGEX);
  return match ? match[1] : null;
}

export async function getVideoMetadata(
  videoId: string
): Promise<{ title: string; thumbnailUrl: string }> {
  const fallback = {
    title: 'YouTube Repair Video',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      title: data.title ?? fallback.title,
      thumbnailUrl: data.thumbnail_url ?? fallback.thumbnailUrl,
    };
  } catch {
    return fallback;
  }
}
