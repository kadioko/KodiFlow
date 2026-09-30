/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
