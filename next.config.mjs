/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    // YouTube thumbnails are already optimized JPEGs served by Google's CDN.
    // Running them through Next's optimizer just adds a sharp dependency and
    // CPU cost for no real benefit. Setting unoptimized:true makes <Image>
    // serve the original URL directly.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [
      'fluent-ffmpeg',
      '@distube/ytdl-core',
      'youtube-transcript',
      'redis',
    ],
  },
};

export default nextConfig;
