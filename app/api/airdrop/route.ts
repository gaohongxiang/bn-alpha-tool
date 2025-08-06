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

    // 设置缓存控制头，确保数据实时更新
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

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