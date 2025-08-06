import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // 获取所有空投数据
    const airdrops = await prisma.airdrop.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    const response = NextResponse.json({
      success: true,
      data: airdrops,
      timestamp: Date.now(),
      lastModified: new Date().toISOString()
    })

    // 优雅的缓存控制 - 针对Vercel优化
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    response.headers.set('CDN-Cache-Control', 'no-store')
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store')

    return response
  } catch (error) {
    console.error('获取空投数据失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取空投数据失败'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 强制刷新空投数据')

    // 获取所有空投数据
    const airdrops = await prisma.airdrop.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    const response = NextResponse.json({
      success: true,
      data: airdrops,
      timestamp: Date.now(),
      lastModified: new Date().toISOString(),
      method: 'POST'
    })

    // 强制不缓存
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    response.headers.set('CDN-Cache-Control', 'no-store')
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store')

    return response
  } catch (error) {
    console.error('获取空投数据失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取空投数据失败'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}