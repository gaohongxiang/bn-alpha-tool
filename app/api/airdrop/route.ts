import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 简化的数据库操作函数，专门针对 Supabase 优化
async function getAirdropsWithTimeout() {
  // 设置查询超时
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('数据库查询超时')), 8000) // 8秒超时
  })

  const queryPromise = prisma.airdrop.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    // 添加查询优化
    take: 1000, // 限制返回数量，避免大数据集问题
  })

  return Promise.race([queryPromise, timeoutPromise])
}

export async function GET() {
  try {
    console.log('📡 获取空投数据...')
    
    // 使用优化的查询函数
    const airdrops = await getAirdropsWithTimeout()

    const response = NextResponse.json({
      success: true,
      data: airdrops,
      timestamp: Date.now(),
      count: Array.isArray(airdrops) ? airdrops.length : 0
    })

    // 适度缓存策略 - 缓存30秒，减少数据库压力
    response.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    response.headers.set('X-Data-Source', 'database')

    return response
  } catch (error) {
    console.error('获取空投数据失败:', error)
    
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const isTimeoutError = errorMessage.includes('超时') || errorMessage.includes('timeout')
    const isConnectionError = errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')
    
    let userFriendlyError = '获取空投数据失败'
    if (isTimeoutError) {
      userFriendlyError = '数据库响应超时，请稍后重试'
    } else if (isConnectionError) {
      userFriendlyError = '数据库连接失败，请检查网络连接'
    }
    
    return NextResponse.json(
      {
        success: false,
        error: userFriendlyError,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        timestamp: Date.now()
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    console.log('🔄 强制刷新空投数据')

    // 强制刷新时也使用相同的优化查询
    const airdrops = await getAirdropsWithTimeout()

    const response = NextResponse.json({
      success: true,
      data: airdrops,
      timestamp: Date.now(),
      count: Array.isArray(airdrops) ? airdrops.length : 0,
      method: 'POST'
    })

    // 强制不缓存
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    response.headers.set('X-Data-Source', 'database-refresh')

    return response
  } catch (error) {
    console.error('强制刷新空投数据失败:', error)
    
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const isTimeoutError = errorMessage.includes('超时') || errorMessage.includes('timeout')
    const isConnectionError = errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')
    
    let userFriendlyError = '刷新空投数据失败'
    if (isTimeoutError) {
      userFriendlyError = '数据库响应超时，请稍后重试'
    } else if (isConnectionError) {
      userFriendlyError = '数据库连接失败，请检查网络连接'
    }
    
    return NextResponse.json(
      {
        success: false,
        error: userFriendlyError,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        timestamp: Date.now()
      },
      { status: 500 }
    )
  }
}