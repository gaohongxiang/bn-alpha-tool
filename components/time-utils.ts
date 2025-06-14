export interface DayTimeRange {
  startTimestamp: number // 当天开始时间戳 (UTC+8 8:00)
  endTimestamp: number   // 当天结束时间戳 (UTC+8 7:59:59)
  dayStr: string         // 日期字符串 (YYYY-MM-DD)
  isCompleted: boolean   // 当天是否已结束
}

export interface BlockRange {
  startBlock: number     // 开始区块号
  endBlock: number       // 结束区块号
  startTimestamp: number // 开始时间戳
  endTimestamp: number   // 结束时间戳
}

export interface TransactionTimeInfo {
  firstTransactionTime?: number  // 首笔有效交易时间
  lastTransactionTime?: number   // 最后一笔有效交易时间
  dayRange: DayTimeRange         // 当天时间范围
}

import { apiManager } from './api-manager'
import { debugLog, debugWarn, debugError } from '../lib/debug-logger'

export class TimeUtils {
  /**
   * 获取北京时间当天日期（按8点分界）
   */
  static getBeiJingToday(): string {
    const now = new Date()
    
    // 直接计算北京时间（UTC+8）
    const utcTime = now.getTime()
    const beijingOffset = 8 * 60 * 60 * 1000 // 8小时毫秒数
    const beijingTime = new Date(utcTime + beijingOffset)
    
    const hour = beijingTime.getUTCHours() // 使用UTC方法避免本地时区影响
    const currentDate = beijingTime.toISOString().split("T")[0]
    
    // 如果当前时间是早上8点之前，则属于前一天
    if (hour < 8) {
      const previousDay = new Date(beijingTime)
      previousDay.setUTCDate(previousDay.getUTCDate() - 1)
      return previousDay.toISOString().split("T")[0]
    } else {
      return currentDate
    }
  }

  /**
   * 根据日期字符串获取当天的时间范围
   * 有效交易时间定义：从指定日期早上8点（UTC+8）到第二天早上8点（UTC+8）
   * 如果查询当天且还没到截止时间，则以当前时间为准
   * @param dateStr 日期字符串 (YYYY-MM-DD)
   * @returns 当天的开始和结束时间戳
   */
  static getDayTimeRange(dateStr: string): DayTimeRange {
    // 计算精确的UTC+8时间范围：从早上8点到第二天早上8点
    const startDateTime = new Date(`${dateStr}T08:00:00+08:00`)
    const endDateTime = new Date(`${dateStr}T08:00:00+08:00`)
    endDateTime.setDate(endDateTime.getDate() + 1) // 第二天早上8点

    const now = Date.now()
    const startTimestamp = Math.floor(startDateTime.getTime() / 1000)
    let endTimestamp = Math.floor(endDateTime.getTime() / 1000)
    
    // 如果查询当天且还没到截止时间（第二天早上8点），使用当前时间作为结束时间
    const isCompleted = now >= endDateTime.getTime()
    if (!isCompleted) {
      endTimestamp = Math.floor(now / 1000)
      debugLog(`📅 时间范围: ${dateStr} 当天进行中，截止到当前时间`)
      debugLog(`   - 开始: ${startDateTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`)
      debugLog(`   - 结束: ${new Date(now).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})} (当前时间)`)
    } else {
      debugLog(`📅 时间范围: ${dateStr} 完整时间段`)
      debugLog(`   - 开始: ${startDateTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`)
      debugLog(`   - 结束: ${endDateTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`)
    }

    return {
      startTimestamp,
      endTimestamp,
      dayStr: dateStr,
      isCompleted
    }
  }

  /**
   * 获取指定时间戳的前一秒时间戳
   * @param timestamp 原时间戳
   * @returns 前一秒的时间戳
   */
  static getBeforeTimestamp(timestamp: number): number {
    return timestamp - 1
  }

  /**
   * 获取指定时间戳的后一秒时间戳
   * @param timestamp 原时间戳
   * @returns 后一秒的时间戳
   */
  static getAfterTimestamp(timestamp: number): number {
    return timestamp + 1
  }

  /**
   * 格式化时间戳为可读字符串
   * @param timestamp 时间戳
   * @returns 格式化的时间字符串
   */
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai'
    })
  }

  /**
   * 根据交易数据获取交易时间信息
   * @param transactions 交易列表
   * @param dayRange 当天时间范围
   * @returns 交易时间信息
   */
  static getTransactionTimeInfo(
    transactions: any[], 
    dayRange: DayTimeRange
  ): TransactionTimeInfo {
    if (transactions.length === 0) {
      return { dayRange }
    }

    // 按时间排序交易
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp)
    
    return {
      firstTransactionTime: sortedTxs[0].timestamp,
      lastTransactionTime: sortedTxs[sortedTxs.length - 1].timestamp,
      dayRange
    }
  }

  /**
   * 获取余额查询时间戳
   * 优先使用当天截止时间，如果当天未结束则使用最后一笔交易时间
   * @param timeInfo 交易时间信息
   * @returns 余额查询时间戳
   */
  static getBalanceQueryTimestamp(timeInfo: TransactionTimeInfo): number {
    if (timeInfo.dayRange.isCompleted) {
      // 当天已结束，使用截止时间
      return timeInfo.dayRange.endTimestamp
    } else if (timeInfo.lastTransactionTime) {
      // 当天未结束但有交易，使用最后一笔交易时间
      return timeInfo.lastTransactionTime
    } else {
      // 当天未结束且无交易，使用当前时间
      return timeInfo.dayRange.endTimestamp
    }
  }

  /**
   * 获取磨损计算的时间戳对
   * @param timeInfo 交易时间信息
   * @returns { beforeTimestamp, afterTimestamp } 磨损计算前后时间戳
   */
  static getLossCalculationTimestamps(timeInfo: TransactionTimeInfo): {
    beforeTimestamp: number
    afterTimestamp: number
  } {
    if (!timeInfo.firstTransactionTime || !timeInfo.lastTransactionTime) {
      // 没有交易时，使用当天开始和结束时间
      return {
        beforeTimestamp: this.getBeforeTimestamp(timeInfo.dayRange.startTimestamp),
        afterTimestamp: this.getAfterTimestamp(timeInfo.dayRange.endTimestamp)
      }
    }

    return {
      beforeTimestamp: this.getBeforeTimestamp(timeInfo.firstTransactionTime),
      afterTimestamp: this.getAfterTimestamp(timeInfo.lastTransactionTime)
    }
  }

  /**
   * 日志输出时间信息
   * @param timeInfo 交易时间信息
   */
  static logTimeInfo(timeInfo: TransactionTimeInfo): void {
    debugLog(`\n=== 时间信息统计 ===`)
    debugLog(`📅 查询日期: ${timeInfo.dayRange.dayStr}`)
    debugLog(`⏰ 当天范围: ${this.formatTimestamp(timeInfo.dayRange.startTimestamp)} ~ ${this.formatTimestamp(timeInfo.dayRange.endTimestamp)}`)
    debugLog(`✅ 当天状态: ${timeInfo.dayRange.isCompleted ? '已结束' : '进行中'}`)
    
    if (timeInfo.firstTransactionTime) {
      debugLog(`🚀 首笔交易: ${this.formatTimestamp(timeInfo.firstTransactionTime)}`)
    } else {
      debugLog(`🚀 首笔交易: 无`)
    }
    
    if (timeInfo.lastTransactionTime) {
      debugLog(`🏁 末笔交易: ${this.formatTimestamp(timeInfo.lastTransactionTime)}`)
    } else {
      debugLog(`🏁 末笔交易: 无`)
    }

    const balanceTime = this.getBalanceQueryTimestamp(timeInfo)
    debugLog(`💰 余额查询时间: ${this.formatTimestamp(balanceTime)}`)

    const { beforeTimestamp, afterTimestamp } = this.getLossCalculationTimestamps(timeInfo)
    debugLog(`📊 磨损计算时间: ${this.formatTimestamp(beforeTimestamp)} ~ ${this.formatTimestamp(afterTimestamp)}`)
  }

  /**
   * 根据时间戳获取对应的区块号
   * @param timestamp 时间戳
   * @param closest 查找方向 ('before' | 'after')
   * @param walletIndex 钱包索引（用于日志）
   * @returns 区块号
   */
  static async getBlockByTimestamp(
    timestamp: number, 
    closest: 'before' | 'after' = 'before',
    walletIndex: number = 0
  ): Promise<number> {
    let lastError: Error | null = null
    
    // 重试3次
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        debugLog(`🔄 钱包 ${walletIndex + 1}: 获取区块号 - 时间戳 ${timestamp} (${closest}) - 尝试 ${attempt}/3`)
        
        const response = await apiManager.makeRequest('bsc', 'bscscan', '', {
          module: 'block',
          action: 'getblocknobytime',
          timestamp: timestamp,
          closest: closest
        })

        if (response.success && response.data?.status === '1') {
          const blockNumber = parseInt(response.data.result)
          debugLog(`✅ 钱包 ${walletIndex + 1}: 区块号获取成功 - ${blockNumber} (尝试 ${attempt}/3)`)
          return blockNumber
        }
        
        const errorMsg = response.error || response.data?.message || '未知错误'
        lastError = new Error(`获取区块号失败: ${errorMsg}`)
        
        debugLog(`⚠️ 钱包 ${walletIndex + 1}: 获取区块号失败 (尝试 ${attempt}/3)`, {
          success: response.success,
          status: response.data?.status,
          message: response.data?.message,
          error: response.error,
          timestamp: timestamp,
          closest: closest
        })
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < 3) {
          const delay = attempt * 1000 // 1秒, 2秒
          debugLog(`⏳ 钱包 ${walletIndex + 1}: 等待 ${delay}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        debugLog(`❌ 钱包 ${walletIndex + 1}: 请求异常 (尝试 ${attempt}/3):`, lastError.message)
        
        if (attempt < 3) {
          const delay = attempt * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error('获取区块号失败: 未知错误')
  }

  /**
   * 根据时间范围获取对应的区块范围
   * @param timeRange 时间范围
   * @param walletIndex 钱包索引（用于日志）
   * @returns 区块范围
   */
  static async getBlockRange(
    timeRange: DayTimeRange, 
    walletIndex: number = 0
  ): Promise<BlockRange> {
    debugLog(`📦 钱包 ${walletIndex + 1}: 开始获取区块范围...`)
    
    try {
      // 并行获取开始和结束区块号
      const [startBlock, endBlock] = await Promise.all([
        this.getBlockByTimestamp(timeRange.startTimestamp, 'after', walletIndex),
        this.getBlockByTimestamp(timeRange.endTimestamp, 'before', walletIndex)
      ])

      debugLog(`📦 钱包 ${walletIndex + 1}: 区块范围获取成功 - ${startBlock} ~ ${endBlock}`)
      
      return {
        startBlock,
        endBlock,
        startTimestamp: timeRange.startTimestamp,
        endTimestamp: timeRange.endTimestamp
      }
    } catch (error) {
      console.error(`❌ 钱包 ${walletIndex + 1}: 获取区块范围失败:`, error)
      throw error
    }
  }

  /**
   * 根据日期字符串直接获取区块范围（便捷方法）
   * @param dateStr 日期字符串 (YYYY-MM-DD)
   * @param walletIndex 钱包索引（用于日志）
   * @returns 区块范围
   */
  static async getBlockRangeByDate(
    dateStr: string, 
    walletIndex: number = 0
  ): Promise<BlockRange> {
    const timeRange = this.getDayTimeRange(dateStr)
    return this.getBlockRange(timeRange, walletIndex)
  }
} 