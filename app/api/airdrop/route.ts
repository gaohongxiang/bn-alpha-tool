import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { validateAirdropData } from '@/lib/features/airdrop'

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
      data: airdrops
    })

    // 设置强制不缓存的头部
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Last-Modified', new Date().toUTCString())
    response.headers.set('ETag', `"${Date.now()}"`)

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