/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 14: keep binary packages external so __dirname resolves from
    // node_modules at runtime, not from inside the webpack bundle
    serverComponentsExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', '@distube/ytdl-core'],

    // Ensure the ffmpeg binary is copied into the deployment file trace
    outputFileTracingIncludes: {
      '/api/analyze': ['./node_modules/ffmpeg-static/**/*'],
    },
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },
};

export default nextConfig;
