import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { validateAirdropData, sanitizeAirdropData, validateTokenUniqueness } from '@/lib/features/airdrop/validation'
import type { AirdropItem } from '@/types/airdrop'

const prisma = new PrismaClient()

// 简单的管理员验证
function verifyAdminAccess(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_KEY || 'admin123'
  const providedKey = request.headers.get('x-admin-key') || request.headers.get('authorization')?.replace('Bearer ', '')
  return providedKey === adminKey
}

// 获取所有空投数据（管理员视图）
export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminAccess(request)) {
      return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 })
    }

    const airdrops = await prisma.airdrop.findMany({
      orderBy: [
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: airdrops,
      total: airdrops.length
    })
  } catch (error) {
    console.error('获取空投数据失败:', error)
    return NextResponse.json(
      { success: false, error: '获取数据失败' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// 创建新的空投数据
export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminAccess(request)) {
      return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 })
    }

    const body = await request.json()
    
    // 数据清理和标准化
    const sanitizedData = sanitizeAirdropData(body)
    
    // 数据验证
    const validation = validateAirdropData(sanitizedData)
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: '数据验证失败',
        details: validation.errors
      }, { status: 400 })
    }

    // 检查代币名称唯一性
    const existingTokens = await prisma.airdrop.findMany({
      select: { token: true }
    })
    const tokenError = validateTokenUniqueness(
      sanitizedData.token!,
      existingTokens.map(item => item.token)
    )
    if (tokenError) {
      return NextResponse.json({
        success: false,
        error: tokenError.message,
        details: [tokenError]
      }, { status: 400 })
    }

    // 创建数据
    const newAirdrop = await prisma.airdrop.create({
      data: {
        date: sanitizedData.date!,
        token: sanitizedData.token!,
        amount: sanitizedData.amount || 0,
        supplementaryToken: sanitizedData.supplementaryToken || 0,
        type: sanitizedData.type || 'alpha',
        currentPrice: sanitizedData.currentPrice || null,
        points: sanitizedData.points || null,
        phase1Points: sanitizedData.phase1Points || null,
        phase2Points: sanitizedData.phase2Points || null,
        startTime: sanitizedData.startTime || null,
        endTime: sanitizedData.endTime || null,
        phase1EndTime: sanitizedData.phase1EndTime || null,
        phase2EndTime: sanitizedData.phase2EndTime || null,
        participants: sanitizedData.participants || null,
        cost: sanitizedData.cost || null,
        pointsConsumed: sanitizedData.pointsConsumed ?? true,
        description: sanitizedData.description || null
      }
    })

    return NextResponse.json({
      success: true,
      data: newAirdrop,
      message: '空投数据创建成功'
    })
  } catch (error) {
    console.error('创建空投数据失败:', error)
    
    // 处理数据库唯一约束错误
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({
        success: false,
        error: '代币名称已存在，请使用其他名称'
      }, { status: 400 })
    }

    return NextResponse.json(
      { success: false, error: '创建数据失败' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// 更新空投数据
export async function PUT(request: NextRequest) {
  try {
    if (!verifyAdminAccess(request)) {
      return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '缺少记录ID'
      }, { status: 400 })
    }

    // 检查记录是否存在
    const existingRecord = await prisma.airdrop.findUnique({
      where: { id: parseInt(id) }
    })

    if (!existingRecord) {
      return NextResponse.json({
        success: false,
        error: '记录不存在'
      }, { status: 404 })
    }

    // 数据清理和标准化
    const sanitizedData = sanitizeAirdropData(updateData)
    
    // 数据验证
    const validation = validateAirdropData(sanitizedData)
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: '数据验证失败',
        details: validation.errors
      }, { status: 400 })
    }

    // 检查代币名称唯一性（排除当前记录）
    const existingTokens = await prisma.airdrop.findMany({
      where: { id: { not: parseInt(id) } },
      select: { token: true }
    })
    const tokenError = validateTokenUniqueness(
      sanitizedData.token!,
      existingTokens.map(item => item.token),
      existingRecord.token
    )
    if (tokenError) {
      return NextResponse.json({
        success: false,
        error: tokenError.message,
        details: [tokenError]
      }, { status: 400 })
    }

    // 更新数据
    const updatedAirdrop = await prisma.airdrop.update({
      where: { id: parseInt(id) },
      data: {
        date: sanitizedData.date!,
        token: sanitizedData.token!,
        amount: sanitizedData.amount || 0,
        supplementaryToken: sanitizedData.supplementaryToken || 0,
        type: sanitizedData.type || 'alpha',
        currentPrice: sanitizedData.currentPrice || null,
        points: sanitizedData.points || null,
        phase1Points: sanitizedData.phase1Points || null,
        phase2Points: sanitizedData.phase2Points || null,
        startTime: sanitizedData.startTime || null,
        endTime: sanitizedData.endTime || null,
        phase1EndTime: sanitizedData.phase1EndTime || null,
        phase2EndTime: sanitizedData.phase2EndTime || null,
        participants: sanitizedData.participants || null,
        cost: sanitizedData.cost || null,
        pointsConsumed: sanitizedData.pointsConsumed ?? true,
        description: sanitizedData.description || null
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedAirdrop,
      message: '空投数据更新成功'
    })
  } catch (error) {
    console.error('更新空投数据失败:', error)
    
    // 处理数据库唯一约束错误
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({
        success: false,
        error: '代币名称已存在，请使用其他名称'
      }, { status: 400 })
    }

    return NextResponse.json(
      { success: false, error: '更新数据失败' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// 删除空投数据
export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminAccess(request)) {
      return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '缺少记录ID'
      }, { status: 400 })
    }

    // 检查记录是否存在
    const existingRecord = await prisma.airdrop.findUnique({
      where: { id: parseInt(id) }
    })

    if (!existingRecord) {
      return NextResponse.json({
        success: false,
        error: '记录不存在'
      }, { status: 404 })
    }

    // 删除记录
    await prisma.airdrop.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({
      success: true,
      message: `空投数据 "${existingRecord.token}" 删除成功`
    })
  } catch (error) {
    console.error('删除空投数据失败:', error)
    return NextResponse.json(
      { success: false, error: '删除数据失败' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
