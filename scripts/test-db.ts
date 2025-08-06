/**
 * 数据库连接测试脚本
 * 验证 Prisma 客户端和数据库连接是否正常
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDatabase() {
  try {
    console.log('🔍 测试数据库连接...')
    
    // 测试数据库连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功！')
    
    // 测试查询
    console.log('📊 测试数据查询...')
    const count = await prisma.airdrop.count()
    console.log(`📈 数据库中共有 ${count} 条空投记录`)
    
    // 获取最新的几条记录
    const latestRecords = await prisma.airdrop.findMany({
      take: 3,
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log('🎯 最新的 3 条记录:')
    latestRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.token} (${record.date}) - ${record.points} 积分`)
    })
    
    console.log('\n🎉 数据库测试完成！')
    
  } catch (error) {
    console.error('❌ 数据库测试失败:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Environment variable not found')) {
        console.log('\n💡 解决方案:')
        console.log('1. 确保 .env 文件存在')
        console.log('2. 检查 DATABASE_URL 环境变量是否正确设置')
        console.log('3. 参考 .env.example 文件配置')
      } else if (error.message.includes('Can\'t reach database server')) {
        console.log('\n💡 解决方案:')
        console.log('1. 检查 Supabase 项目是否正常运行')
        console.log('2. 验证数据库连接字符串是否正确')
        console.log('3. 确保网络连接正常')
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('\n💡 解决方案:')
        console.log('1. 运行 pnpm db:push 创建数据库表')
        console.log('2. 或运行 pnpm db:migrate 应用迁移')
      }
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
testDatabase()
