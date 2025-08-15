/**
 * 统一数据管理脚本
 * 支持数据导入和导出功能
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface JsonAirdropItem {
  date: string
  token: string
  points?: number | string
  participants?: number | null
  amount: number | string
  supplementaryToken: number
  currentPrice?: string
  type: 'alpha' | 'tge' | 'preTge'
  cost?: number | string
  pointsConsumed?: boolean
  startTime?: string
  endTime?: string
  phase1Points?: number | string
  phase2Points?: number | string
  phase1EndTime?: string
  phase2EndTime?: string
  description?: string
}

// 数据清理和转换函数
function cleanAndConvertData(item: JsonAirdropItem) {
  // 转换数字字段
  const convertToNumber = (value: number | string | undefined, defaultValue: number = 0): number => {
    if (value === undefined || value === null || value === '' || value === '-') {
      return defaultValue
    }
    const num = typeof value === 'string' ? parseFloat(value) : value
    return isNaN(num) ? defaultValue : num
  }

  // 转换整数字段
  const convertToInt = (value: number | string | undefined, defaultValue: number = 0): number => {
    if (value === undefined || value === null || value === '' || value === '-') {
      return defaultValue
    }
    const num = typeof value === 'string' ? parseInt(value) : value
    return isNaN(num) ? defaultValue : num
  }

  // 清理价格字段
  const cleanPrice = (price: string | undefined): string | null => {
    if (!price || price === '-' || price === '') return null
    return price
  }

  // 清理时间字段
  const cleanTime = (time: string | undefined): string | null => {
    if (!time || time === '-' || time === '') return null
    return time
  }

  return {
    date: item.date,
    token: item.token,
    points: convertToInt(item.points),
    participants: item.participants,
    amount: convertToNumber(item.amount),
    supplementaryToken: convertToNumber(item.supplementaryToken),
    currentPrice: cleanPrice(item.currentPrice),
    type: item.type,
    cost: item.cost ? convertToNumber(item.cost) : undefined,
    pointsConsumed: item.pointsConsumed ?? true,
    startTime: cleanTime(item.startTime),
    endTime: cleanTime(item.endTime),
    phase1Points: item.phase1Points ? convertToInt(item.phase1Points) : undefined,
    phase2Points: item.phase2Points ? convertToInt(item.phase2Points) : undefined,
    phase1EndTime: cleanTime(item.phase1EndTime),
    phase2EndTime: cleanTime(item.phase2EndTime),
    description: item.description || undefined,
  }
}

// 数据导入功能
async function importData() {
  try {
    console.log('📥 开始数据导入...')

    // 检查备份目录
    const backupDir = path.join(process.cwd(), 'data/backups')
    if (!fs.existsSync(backupDir)) {
      console.error('❌ 找不到备份目录:', backupDir)
      return
    }

    // 获取所有备份文件
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('airdrop-backup-') && file.endsWith('.json'))
      .sort()
      .reverse() // 最新的在前面

    if (backupFiles.length === 0) {
      console.error('❌ 没有找到备份文件')
      return
    }

    // 选择最新的备份文件
    const latestBackup = backupFiles[0]
    const jsonPath = path.join(backupDir, latestBackup)
    
    console.log(`📁 使用最新备份文件: ${latestBackup}`)
    
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ 找不到数据文件:', jsonPath)
      return
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as JsonAirdropItem[]
    console.log(`📊 找到 ${jsonData.length} 条记录`)

    // 检查数据库连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 清理和转换数据
    const cleanedData = jsonData.map(cleanAndConvertData)
    console.log('🧹 数据清理完成')

    // 检查现有数据
    const existingCount = await prisma.airdrop.count()
    console.log(`📈 数据库中现有 ${existingCount} 条记录`)

    if (existingCount > 0) {
      console.log('⚠️  数据库中已有数据，将跳过重复的记录')
    }

    // 批量插入数据
    let insertedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const item of cleanedData) {
      try {
        // 检查是否已存在
        const existing = await prisma.airdrop.findUnique({
          where: { token: item.token }
        })

        if (existing) {
          console.log(`⏭️  跳过已存在的记录: ${item.token}`)
          skippedCount++
          continue
        }

        // 插入新记录
        await prisma.airdrop.create({
          data: item as any
        })

        console.log(`✅ 插入成功: ${item.token} (${item.date})`)
        insertedCount++

      } catch (error) {
        console.error(`❌ 插入失败: ${item.token}`, error)
        errorCount++
      }
    }

    console.log('\n📊 导入完成统计:')
    console.log(`✅ 成功插入: ${insertedCount} 条`)
    console.log(`⏭️  跳过重复: ${skippedCount} 条`)
    console.log(`❌ 插入失败: ${errorCount} 条`)
    console.log(`📈 总计处理: ${cleanedData.length} 条`)

    // 验证导入结果
    const finalCount = await prisma.airdrop.count()
    console.log(`\n🎉 数据库中现有总记录数: ${finalCount}`)

    // 显示最新的几条记录
    const latestRecords = await prisma.airdrop.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { token: true, date: true, type: true, points: true }
    })

    console.log('\n🎯 最新的 5 条记录:')
    latestRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.token} (${record.date}) - ${record.type.toUpperCase()} - ${record.points} 积分`)
    })

  } catch (error) {
    console.error('❌ 导入过程中发生错误:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Environment variable not found')) {
        console.log('\n💡 解决方案:')
        console.log('1. 确保 .env 文件存在')
        console.log('2. 检查 DATABASE_URL 环境变量是否正确设置')
      } else if (error.message.includes('Can\'t reach database server')) {
        console.log('\n💡 解决方案:')
        console.log('1. 检查 Supabase 项目是否正常运行')
        console.log('2. 验证数据库连接字符串是否正确')
      }
    }
    
    process.exit(1)
  }
}

// 列出备份文件功能
async function listBackups() {
  try {
    console.log('📋 列出所有备份文件...')

    const backupDir = path.join(process.cwd(), 'data/backups')
    if (!fs.existsSync(backupDir)) {
      console.log('❌ 备份目录不存在:', backupDir)
      return
    }

    // 获取所有备份文件
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('airdrop-backup-') && file.endsWith('.json'))
      .sort()
      .reverse() // 最新的在前面

    if (backupFiles.length === 0) {
      console.log('📁 没有找到备份文件')
      return
    }

    console.log(`📊 找到 ${backupFiles.length} 个备份文件:\n`)

    backupFiles.forEach((file, index) => {
      const filePath = path.join(backupDir, file)
      const stats = fs.statSync(filePath)
      const fileSizeKB = (stats.size / 1024).toFixed(2)
      const createTime = stats.mtime.toISOString().split('T')[0]
      
      const isLatest = index === 0 ? ' 🌟 (最新)' : ''
      console.log(`  ${index + 1}. ${file}${isLatest}`)
      console.log(`     📅 创建时间: ${createTime}`)
      console.log(`     📏 文件大小: ${fileSizeKB} KB`)
      console.log('')
    })

    console.log(`💡 使用 'pnpm db:import' 将自动导入最新的备份文件: ${backupFiles[0]}`)

  } catch (error) {
    console.error('❌ 列出备份文件时发生错误:', error)
    process.exit(1)
  }
}

// 数据导出功能
async function exportData() {
  try {
    console.log('📤 开始数据导出...')

    // 检查数据库连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 从数据库获取所有数据
    const allData = await prisma.airdrop.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        date: true,
        token: true,
        points: true,
        participants: true,
        amount: true,
        supplementaryToken: true,
        currentPrice: true,
        type: true,
        cost: true,
        pointsConsumed: true,
        startTime: true,
        endTime: true,
        phase1Points: true,
        phase2Points: true,
        phase1EndTime: true,
        phase2EndTime: true,
        description: true,
      }
    })

    console.log(`📊 从数据库获取到 ${allData.length} 条记录`)

    if (allData.length === 0) {
      console.log('⚠️  数据库中没有数据可导出')
      return
    }

    // 转换数据格式，移除 null 值和空字符串
    const exportData = allData.map(item => {
      const cleanItem: any = {}
      
      // 必填字段
      cleanItem.date = item.date
      cleanItem.token = item.token
      cleanItem.amount = item.amount
      cleanItem.supplementaryToken = item.supplementaryToken
      cleanItem.type = item.type

      // 可选字段，只有有值时才添加
      if (item.points && item.points > 0) cleanItem.points = item.points
      if (item.participants) cleanItem.participants = item.participants
      if (item.currentPrice) cleanItem.currentPrice = item.currentPrice
      if (item.cost) cleanItem.cost = item.cost
      if (item.pointsConsumed === false) cleanItem.pointsConsumed = false
      if (item.startTime) cleanItem.startTime = item.startTime
      if (item.endTime) cleanItem.endTime = item.endTime
      if (item.phase1Points) cleanItem.phase1Points = item.phase1Points
      if (item.phase2Points) cleanItem.phase2Points = item.phase2Points
      if (item.phase1EndTime) cleanItem.phase1EndTime = item.phase1EndTime
      if (item.phase2EndTime) cleanItem.phase2EndTime = item.phase2EndTime
      if (item.description) cleanItem.description = item.description

      return cleanItem
    })

    // 确保备份目录存在
    const backupDir = path.join(process.cwd(), 'data/backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
      console.log('📁 创建备份目录:', backupDir)
    }

    // 生成文件名（带时间戳）
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `airdrop-backup-${timestamp}.json`
    const backupPath = path.join(backupDir, filename)

    // 写入文件
    fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2), 'utf-8')

    console.log(`✅ 数据导出成功!`)
    console.log(`📁 文件位置: ${backupPath}`)
    console.log(`📊 导出记录数: ${exportData.length}`)

    // 显示文件大小
    const stats = fs.statSync(backupPath)
    const fileSizeKB = (stats.size / 1024).toFixed(2)
    console.log(`📏 文件大小: ${fileSizeKB} KB`)

    // 显示最新的几条记录
    const latestRecords = exportData.slice(-5)
    console.log('\n🎯 最新的 5 条记录:')
    latestRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.token} (${record.date}) - ${record.type.toUpperCase()}`)
    })

  } catch (error) {
    console.error('❌ 导出过程中发生错误:', error)
    process.exit(1)
  }
}

// 主函数
async function main() {
  const action = process.argv[2]

  console.log('🎯 BN Alpha Tool - 数据管理工具')
  console.log('=' .repeat(50))

  if (action === 'import') {
    await importData()
  } else if (action === 'export') {
    await exportData()
  } else if (action === 'list') {
    await listBackups()
  } else {
    console.log('❌ 无效的操作参数')
    console.log('\n使用方法:')
    console.log('  pnpm db:import       # 从最新备份文件导入数据到数据库')
    console.log('  pnpm db:export       # 从数据库导出数据到备份文件')
    console.log('  pnpm db:list-backups # 列出所有可用的备份文件')
    process.exit(1)
  }

  await prisma.$disconnect()
  console.log('\n🔌 数据库连接已关闭')
}

// 运行主函数
main().catch((error) => {
  console.error('❌ 程序执行失败:', error)
  process.exit(1)
})