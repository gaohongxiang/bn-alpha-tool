import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// 导入统一的类型定义
import type { WalletData, ExportDataRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { selectedDate, walletData, totalStats }: ExportDataRequest = await request.json()
    
    if (!selectedDate || !walletData || !Array.isArray(walletData)) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }
    
    // 确保data/exports目录存在
    const exportsDir = join(process.cwd(), 'data', 'exports')
    if (!existsSync(exportsDir)) {
      await mkdir(exportsDir, { recursive: true })
    }
    
    // 生成文件名：wallet-data-YYYY-MM-DD.txt
    const fileName = `wallet-data-${selectedDate}.txt`
    const filePath = join(exportsDir, fileName)
    
    // 生成导出内容
    const content = generateDataContent(selectedDate, walletData, totalStats)
    
    // 写入文件
    await writeFile(filePath, content, 'utf-8')
    
    return NextResponse.json({
      success: true,
      filePath: `data/exports/${fileName}`,
      message: '数据导出成功',
      recordCount: walletData.length
    })
    
  } catch (error) {
    console.error('导出数据失败:', error)
    return NextResponse.json(
      { error: '导出数据失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

function generateDataContent(selectedDate: string, walletData: WalletData[], totalStats: any): string {
  const lines: string[] = []
  const timestamp = new Date().toLocaleString('zh-CN')
  
  // 文件头部信息
  lines.push('===============================================')
  lines.push('            钱包数据分析报告')
  lines.push('===============================================')
  lines.push(`查询日期: ${selectedDate}`)
  lines.push(`导出时间: ${timestamp}`)
  lines.push(`钱包数量: ${walletData.length}`)
  lines.push(`时间范围: 每日8:00-次日7:59 (UTC+8)`)
  lines.push('')
  
  // 总体统计
  lines.push('===============================================')
  lines.push('                总体统计')
  lines.push('===============================================')
  lines.push(`总余额:        $${totalStats?.totalBalance?.toFixed(2) || '0.00'}`)
  lines.push(`总交易量:      $${totalStats?.totalVolume?.toFixed(2) || '0.00'}`)
  lines.push(`总交易次数:    ${totalStats?.totalTransactions || 0}`)
  lines.push(`总交易磨损:    $${totalStats?.totalTradingLoss?.toFixed(2) || '0.00'}`)
  lines.push(`总Gas费:       $${totalStats?.totalGasLoss?.toFixed(2) || '0.00'}`)
  lines.push(`总磨损:        $${((totalStats?.totalTradingLoss || 0) + (totalStats?.totalGasLoss || 0)).toFixed(2)}`)
  lines.push(`总预估积分:    ${totalStats?.totalPoints || 0}分`)
  lines.push('')
  
  // 各钱包详细数据
  lines.push('===============================================')
  lines.push('              各钱包详细数据')
  lines.push('===============================================')
  
  walletData.forEach((wallet, index) => {
    lines.push('')
    lines.push(`【钱包 ${index + 1}】`)
    lines.push('-----------------------------------------------')
    lines.push(`地址:         ${wallet.address}`)
    lines.push(`备注:         ${wallet.note}`)
    
    if (wallet.error) {
      lines.push(`状态:         ❌ 查询失败`)
      lines.push(`错误信息:     ${wallet.error}`)
    } else {
      lines.push(`状态:         ✅ 查询成功`)
      lines.push('')
      
      // 余额信息
      lines.push('【余额信息】')
      if (wallet.tokenBalances && wallet.tokenBalances.length > 0) {
        wallet.tokenBalances
          .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
          .forEach(token => {
            lines.push(`  ${token.symbol}: ${token.balance.toFixed(6)} ($${token.usdValue.toFixed(2)})`)
          })
        const totalBalance = wallet.tokenBalances
          .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
          .reduce((sum, token) => sum + token.usdValue, 0)
        lines.push(`  总余额: $${totalBalance.toFixed(2)}`)
      } else {
        lines.push('  无余额数据')
      }
      lines.push('')
      
      // 交易信息
      lines.push('【交易信息】')
      lines.push(`  交易量:       $${wallet.tradingVolume?.toFixed(2) || '0.00'}`)
      lines.push(`  交易次数:     ${wallet.transactionCount || 0}`)
      lines.push(`  交易磨损:     $${wallet.tradingLoss?.toFixed(2) || '0.00'}`)
      lines.push(`  Gas费:        $${wallet.gasLoss?.toFixed(2) || '0.00'}`)
      lines.push(`  总磨损:       $${((wallet.tradingLoss || 0) + (wallet.gasLoss || 0)).toFixed(2)}`)
      lines.push('')
      
      // 积分信息
      lines.push('【积分信息】')
      lines.push(`  预估总积分:   ${wallet.estimatedPoints || 0}分`)
      const balanceValue = wallet.tokenBalances
        ?.filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
        ?.reduce((sum, token) => sum + token.usdValue, 0) || 0
      // 这里需要导入PointsUtils来计算，暂时简化处理
      lines.push(`  余额积分:     约${Math.floor(balanceValue / 1000)}分`)
      lines.push(`  交易积分:     约${Math.floor((wallet.tradingVolume || 0) * 2 / 1000)}分`)
    }
  })
  
  // 文件尾部
  lines.push('')
  lines.push('===============================================')
  lines.push('              报告结束')
  lines.push('===============================================')
  lines.push(`生成时间: ${timestamp}`)
  lines.push('注：积分计算为预估值，实际积分以官方为准')
  
  return lines.join('\n')
} 