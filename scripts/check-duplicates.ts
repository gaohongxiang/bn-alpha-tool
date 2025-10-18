import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicates() {
  try {
    console.log('🔍 检查可能的重复数据...')
    
    // 检查真正的重复：相同代币名称、日期和类型
    const trueDuplicates = await prisma.$queryRaw`
      SELECT token, date, type, COUNT(*) as count
      FROM airdrops
      GROUP BY token, date, type
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `
    
    // 检查同名代币（可能是合理的重名）
    const sameNameTokens = await prisma.$queryRaw`
      SELECT token, COUNT(*) as count
      FROM airdrops
      GROUP BY token
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `
    
    console.log('\n=== 真正的重复数据（需要处理）===')
    if (Array.isArray(trueDuplicates) && trueDuplicates.length > 0) {
      console.log('⚠️  发现真正的重复数据:')
      for (const dup of trueDuplicates) {
        const records = await prisma.airdrop.findMany({
          where: { 
            token: (dup as any).token,
            date: (dup as any).date,
            type: (dup as any).type
          },
          select: { id: true, token: true, date: true, type: true, createdAt: true }
        })
        console.log(`\n❌ ${(dup as any).token} - ${(dup as any).date} - ${(dup as any).type} (${(dup as any).count} 条记录)`)
        records.forEach(record => {
          console.log(`   ID: ${record.id}, 创建时间: ${record.createdAt}`)
        })
      }
    } else {
      console.log('✅ 没有发现真正的重复数据')
    }
    
    console.log('\n=== 同名代币统计（可能是合理的重名）===')
    if (Array.isArray(sameNameTokens) && sameNameTokens.length > 0) {
      console.log('ℹ️  发现同名代币:')
      for (const dup of sameNameTokens) {
        const records = await prisma.airdrop.findMany({
          where: { token: (dup as any).token },
          select: { id: true, token: true, date: true, type: true, description: true }
        })
        console.log(`\n📊 ${(dup as any).token} (${(dup as any).count} 条记录)`)
        records.forEach(record => {
          const desc = record.description ? ` - ${record.description}` : ''
          console.log(`   ${record.date} | ${record.type}${desc}`)
        })
      }
    } else {
      console.log('ℹ️  所有代币名称都是唯一的')
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicates()