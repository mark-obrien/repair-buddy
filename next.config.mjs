/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep native/binary packages external so __dirname resolves from node_modules, not the bundle
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', '@distube/ytdl-core'],

  experimental: {
    // Ensure the ffmpeg binary is included in the deployment file trace
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
