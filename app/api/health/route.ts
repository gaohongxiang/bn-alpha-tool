import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const startTime = Date.now()
  
  try {
    // 测试数据库连接
    await prisma.$queryRaw`SELECT 1`
    
    // 测试空投表查询
    const count = await prisma.airdrop.count()
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: 'healthy',
      database: {
        connected: true,
        responseTime: `${responseTime}ms`,
        recordCount: count
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    
    console.error('数据库健康检查失败:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      database: {
        connected: false,
        responseTime: `${responseTime}ms`,
        error: errorMessage
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    }, { status: 503 })
  }
}