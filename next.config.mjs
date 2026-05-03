/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
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
