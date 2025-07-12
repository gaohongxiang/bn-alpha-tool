import type { DayTimeRange } from '@/types/time'
import { logger } from "@/lib/core/logger"
import type { TokenDataOfNetwork, BlockRangeInfo } from '../../core/token-manager'

/**
 * 区块范围功能模块 - 简化版
 * 核心功能：根据日期获取区块范围
 */
export class BlockRange {

  /**
   * 根据日期字符串获取当天的时间范围
   * @param dateStr 日期字符串 (YYYY-MM-DD)
   * @returns DayTimeRange
   */
  static getDayTimeRange(dateStr: string): DayTimeRange {
    // 开始时间：当天00:00:00 UTC
    const startDateTime = new Date(`${dateStr}T00:00:00Z`)
    const startTimestamp = Math.floor(startDateTime.getTime() / 1000)

    // 当天结束时间：当天23:59:59 UTC
    const dayEndDateTime = new Date(`${dateStr}T23:59:59Z`)
    const now = Date.now()

    // 判断当天是否已经结束
    const isCompleted = now > dayEndDateTime.getTime()

    // 结束时间：已结束用当天23:59:59，未结束用当前时间
    const endTimestamp = isCompleted
      ? Math.floor(dayEndDateTime.getTime() / 1000)
      : Math.floor(now / 1000)

    const startISO = startDateTime.toISOString()
    const endISO = new Date(endTimestamp * 1000).toISOString()

    logger.debug('general', `📅 ${dateStr}: ${startISO} → ${endISO} ${isCompleted ? '(已结束)' : '(进行中)'}`)

    return {
      startTimestamp,
      endTimestamp,
      startISO,
      endISO,
      dayStr: dateStr,
      isCompleted,
    }
  }

  /**
   * 主要功能：获取所有网络在指定日期的区块范围
   * @param dateStr 日期字符串 (YYYY-MM-DD)
   * @param httpClient HTTP 客户端实例
   * @param tokenDataOfNetworks 网络配置数据
   * @returns 所有网络的区块范围映射
   */
  static async getBlockRangesForAllNetworks(
    dateStr: string,
    httpClient: any,
    tokenDataOfNetworks: { [networkId: string]: TokenDataOfNetwork }
  ): Promise<{ [chainIdHex: string]: BlockRangeInfo }> {
    const networkList = Object.values(tokenDataOfNetworks)

    if (networkList.length === 0) {
      throw new Error('未找到任何网络配置')
    }

    // 检查缓存
    const allCached = networkList.every(network => network.blockRanges)
    if (allCached) {
      logger.debug('general', `💾 使用缓存的区块范围`)
      const result: { [chainIdHex: string]: BlockRangeInfo } = {}
      networkList.forEach(network => {
        if (network.blockRanges) {
          result[network.chainIdHex] = network.blockRanges
        }
      })
      return result
    }

    // 执行查询
    const timeRange = this.getDayTimeRange(dateStr)
    const blockRanges: { [chainIdHex: string]: BlockRangeInfo } = {}

    // 并发查询所有网络的区块范围
    const tasks = networkList.map(async (networkData) => {
      try {
        // 检查缓存
        if (networkData.blockRanges) {
          blockRanges[networkData.chainIdHex] = networkData.blockRanges
          return
        }

        // 查询起始区块
        const startBlock = await this.getDateToBlock(httpClient, networkData.chainIdHex, timeRange.startISO, '起始')

        let endBlock: number

        if (timeRange.isCompleted) {
          // 历史查询：查询结束区块
          const rawEndBlock = await this.getDateToBlock(httpClient, networkData.chainIdHex, timeRange.endISO, '结束')
          endBlock = rawEndBlock - 1  // 减1避免边界问题
          logger.debug('general', `📍 历史查询，计算区块: ${rawEndBlock} -> 使用区块: ${endBlock}`)
        } else {
          // 今天的查询：使用最新区块号HTTP API，并减去安全缓冲
          logger.debug('general', `📍 进行中的日期，使用最新区块号API`)
          const latestBlock = await this.getLatestBlockNumber(httpClient, networkData.chainIdHex)
          endBlock = latestBlock - 1  // 减去1个区块作为安全缓冲，确保区块已被确认
          logger.debug('general', `📍 最新区块: ${latestBlock}, 使用安全区块: ${endBlock}`)
        }

        const blockRangeInfo: BlockRangeInfo = {
          startBlock,
          endBlock,
          startISO: timeRange.startISO,
          endISO: timeRange.endISO
        }

        // 缓存结果
        networkData.blockRanges = blockRangeInfo
        blockRanges[networkData.chainIdHex] = blockRangeInfo

        logger.debug('general', `✅ ${networkData.network}: 区块 ${startBlock} - ${endBlock}`)

      } catch (error) {
        logger.debug('general', `❌ ${networkData.network} 区块查询失败: ${error}`)
      }
    })

    await Promise.allSettled(tasks)

    if (Object.keys(blockRanges).length === 0) {
      throw new Error('所有网络的区块查询都失败了')
    }

    return blockRanges
  }

  /**
   * 根据日期获取区块号
   * @param httpClient HTTP 客户端实例
   * @param chainIdHex 链ID（十六进制）
   * @param dateISO ISO 格式的日期字符串
   * @param type 查询类型（用于日志显示）
   * @returns 区块号
   */
  static async getDateToBlock(httpClient: any, chainIdHex: string, dateISO: string, type: string = ''): Promise<number> {
    try {
      // 使用 HTTP API 直接调用 Moralis DateToBlock 接口
      const params = new URLSearchParams({
        chain: chainIdHex,
        date: dateISO
      })
      const url = `https://deep-index.moralis.io/api/v2.2/dateToBlock?${params.toString()}`

      logger.debug('general', `🔄 直接调用 Moralis DateToBlock API${type ? ` (${type})` : ''}: ${chainIdHex}`)

      const response = await httpClient.get(url)

      if (!response.ok) {
        throw new Error(`DateToBlock API 请求失败${type ? ` (${type})` : ''}: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      if (!result || typeof result !== 'object') {
        throw new Error(`DateToBlock API 返回数据格式错误${type ? ` (${type})` : ''}`)
      }

      const blockNumber = result.block
      logger.debug('general', `🔗 网络 ${chainIdHex}${type ? ` ${type}` : ''} 区块号: ${blockNumber}`)
      return blockNumber
    } catch (error) {
      logger.debug('general', `❌ 获取区块号失败${type ? ` (${type})` : ''} (${chainIdHex}): ${error}`)
      throw new Error(`获取区块号失败${type ? ` (${type})` : ''}: ${error}`)
    }
  }

  /**
   * 获取网络的最新区块号（官方sdk文档有Moralis.EvmApi.block.getLatestBlockNumber方法，但是实测没有，该用http请求）
   * @param httpClient HTTP 客户端实例
   * @param chainIdHex 链ID（十六进制）
   * @returns 最新区块号
   */
  static async getLatestBlockNumber(httpClient: any, chainIdHex: string): Promise<number> {
    try {
      // 使用 HTTP API 直接调用 Moralis 最新区块号接口
      const url = `https://deep-index.moralis.io/api/v2.2/latestBlockNumber/${chainIdHex}`

      logger.debug('general', `🔄 直接调用 Moralis 最新区块号 API: ${chainIdHex}`)

      const response = await httpClient.get(url)

      if (!response.ok) {
        throw new Error(`最新区块号 API 请求失败: ${response.status} ${response.statusText}`)
      }

      let latestBlock = await response.json()
      latestBlock = latestBlock - 1
      logger.debug('general', `🔗 网络 ${chainIdHex} 最新区块号: ${latestBlock}`)
      return latestBlock
    } catch (error) {
      logger.debug('general', `❌ 获取最新区块号失败 (${chainIdHex}): ${error}`)
      throw new Error(`获取最新区块号失败: ${error}`)
    }
  }

}
