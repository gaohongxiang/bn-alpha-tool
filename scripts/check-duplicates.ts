import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicates() {
  try {
    console.log('🔍 检查重复的 token...')
    
    const duplicates = await prisma.$queryRaw`
      SELECT token, COUNT(*) as count
      FROM airdrops
      GROUP BY token
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `
    
    console.log('重复的 token:', duplicates)
    
    if (Array.isArray(duplicates) && duplicates.length > 0) {
      console.log('\n📋 重复数据详情:')
      for (const dup of duplicates) {
        const records = await prisma.airdrop.findMany({
          where: { token: (dup as any).token },
          select: { id: true, token: true, date: true, createdAt: true }
        })
        console.log(`\nToken: ${(dup as any).token} (${(dup as any).count} 条记录)`)
        records.forEach(record => {
          console.log(`  ID: ${record.id}, 日期: ${record.date}, 创建时间: ${record.createdAt}`)
        })
      }
    } else {
      console.log('✅ 没有发现重复的 token')
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicates()