import { NextRequest, NextResponse } from 'next/server'
import { RevenueAnalyzer } from '@/lib/features/revenue/index'
import { Points } from '@/lib/features/points'
import { logger } from '@/lib/core/logger'
import { initializeApiLogger, logSessionStart, logSessionEnd, logInfo, logError, getAllCachedLogs, clearLogBuffer } from '@/lib/core/logger/api-logger'

/**
 * 收益分析 API
 * 前端只需要发送钱包地址和日期，后端处理所有业务逻辑
 */

// 导入统一的类型定义
import type { WalletData, AnalyzeResponse } from '@/types'

interface AnalyzeRequest {
  walletAddresses: string[]
  date: string
  config?: {
    batchSize?: number
    concurrency?: number
    retryAttempts?: number
    forceRefresh?: boolean
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  const startTime = Date.now()

  try {
    const body: AnalyzeRequest = await request.json()
    const { walletAddresses, date, config } = body

    // 输入验证
    if (!walletAddresses || !Array.isArray(walletAddresses) || walletAddresses.length === 0) {
      return NextResponse.json({
        success: false,
        error: '钱包地址列表不能为空'
      }, { status: 400 })
    }

    if (!date) {
      return NextResponse.json({
        success: false,
        error: '查询日期不能为空'
      }, { status: 400 })
    }

    // 启动服务端日志会话，与客户端同步
    const sessionId = `钱包分析_${date}`

    // 初始化API专用 Winston 日志器，传入会话ID
    const apiLogger = await initializeApiLogger(sessionId)

    // 将API Logger设置为winston-logger的后端
    logger.setServerWinston(apiLogger)

    // 使用服务端 Winston 记录详细会话信息
    logSessionStart(sessionId, {
      walletCount: walletAddresses.length,
      date: date,
      config: config,
      timestamp: new Date().toISOString()
    })

    // 客户端兼容的 logger
    logger.startSession(sessionId)

    logger.debug('api-request', `🔥 [API] 收到批量分析请求`)
    logger.debug('api-request', `📋 [API] 请求参数`, {
      钱包数量: walletAddresses.length,
      查询日期: date,
      配置: config
    })
    logger.debug('api-request', `📝 [API] 钱包地址列表`, walletAddresses.map((addr, i) => `${i+1}. ${addr}`))

    // 调用新的收益分析器
    logger.debug('api-processing', `🚀 [API] 开始调用 RevenueAnalyzer.analyzeMultipleWallets...`)

    // 捕获详细的处理过程日志
    const processingStartTime = Date.now()
    const results = await RevenueAnalyzer.analyzeMultipleWallets(
      walletAddresses,
      date,
      {
        ...config,
        forceRefresh: config?.forceRefresh || true  // 默认强制刷新缓存
      }
    )
    const processingTime = Date.now() - processingStartTime

    // 手动添加一些关键的处理信息到日志中
    logger.debug('api-processing', `⏱️ [API] 处理耗时: ${processingTime}ms`)
    logger.debug('api-processing', `📊 [API] 处理结果: ${results.length} 个钱包完成分析`)

    logger.debug('api-processing', `📊 [API] 收到分析结果，开始处理 ${results.length} 个钱包数据`)

    // 处理结果并计算积分
    const walletResults: WalletData[] = results.map((result, index) => {
      const address = walletAddresses[index]

      // 检查是否有错误信息（优先使用 result.error）
      if (result.error) {
        logger.warn('wallet-processing', `❌ [API] 钱包 ${index + 1} (${address}): ${result.error}`)
        return {
          address,
          tokensValue: 0,
          points: 0,
          balancePoints: 0,
          volumePoints: 0,
          error: result.error
        }
      }

      // 检查是否为空数据（作为备用检查）
      if (!result || (result.tokensValue === 0 && !result.transactionData)) {
        logger.warn('wallet-processing', `❌ [API] 钱包 ${index + 1} (${address}): 查询失败或无数据`)
        return {
          address,
          tokensValue: 0,
          points: 0,
          balancePoints: 0,
          volumePoints: 0,
          error: '查询失败或钱包无数据'
        }
      }

      // 计算积分
      const balancePoints = Points.balancePoints(result.tokensValue || 0)
      const volumePoints = Points.tradingVolumePoints(result.transactionData?.totalBoughtValue || 0)
      const points = balancePoints + volumePoints

      logger.debug('wallet-processing', `✅ [API] 钱包 ${index + 1} (${address}): 余额=$${result.tokensValue?.toFixed(2)}, 积分=${points}`)

      return {
        address,
        tokensValue: result.tokensValue || 0,
        transactionData: result.transactionData,
        points,
        balancePoints,
        volumePoints,
        error: undefined  // 明确设置为 undefined 表示没有错误
      }
    })

    // 计算汇总数据
    const successCount = walletResults.filter(w => !w.error).length
    const errorCount = walletResults.filter(w => w.error).length
    const totalBalance = walletResults.reduce((sum, w) => sum + w.tokensValue, 0)
    const totalVolume = walletResults.reduce((sum, w) => sum + (w.transactionData?.totalBoughtValue || 0), 0)
    const totalPoints = walletResults.reduce((sum, w) => sum + w.points, 0)

    logger.debug('api-complete', `✅ [API] 分析完成: ${successCount}成功, ${errorCount}失败, 耗时${processingTime}ms`)
    logger.debug('api-summary', `📊 [API] 汇总统计`, {
      总钱包数: walletAddresses.length,
      成功数: successCount,
      失败数: errorCount,
      总余额: `$${totalBalance.toFixed(2)}`,
      总交易额: `$${totalVolume.toFixed(2)}`,
      总积分: totalPoints,
      处理时间: `${processingTime}ms`
    })

    // 简化日志处理 - 只记录到主日志文件，不创建额外的会话文件
    logger.info('api-complete', `✅ API处理完成`, {
      sessionId,
      walletCount: walletAddresses.length,
      successCount,
      errorCount,
      totalBalance,
      totalVolume,
      totalPoints,
      processingTime
    })

    // 清空日志缓存
    clearLogBuffer()
    logger.endSession()

    // 记录会话结束
    const sessionDuration = Date.now() - startTime
    logSessionEnd(sessionId, sessionDuration, {
      successCount,
      errorCount,
      totalBalance,
      totalVolume,
      totalPoints,
      processingTime
    })

    logger.endSession()

    return NextResponse.json({
      success: true,
      data: {
        wallets: walletResults,
        summary: {
          totalWallets: walletAddresses.length,
          successCount,
          errorCount,
          totalBalance,
          totalVolume,
          totalPoints,
          processingTime
        }
      }
    })

  } catch (error) {
    logger.error('api-error', `❌ [API] 收益分析失败: ${error}`)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
