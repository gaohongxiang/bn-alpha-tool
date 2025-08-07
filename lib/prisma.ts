/**
 * Prisma 客户端实例
 * 针对 Vercel + Supabase 环境优化的数据库连接
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Vercel + Supabase 优化配置
    transactionOptions: {
      timeout: 10000, // 10秒事务超时
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 优雅关闭连接
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
