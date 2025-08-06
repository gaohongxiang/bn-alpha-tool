/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 针对Vercel部署优化：禁用静态优化以确保API路由实时性
  experimental: {
    isrMemoryCacheSize: 0, // 禁用ISR内存缓存
  },
  // 确保API路由不被静态化
  trailingSlash: false,
}

export default nextConfig
