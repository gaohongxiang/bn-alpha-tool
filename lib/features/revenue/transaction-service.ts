/**
 * 交易服务 - 交易数据查询和统计分析
 * 纯业务逻辑服务，不负责配置加载和初始化
 */

import { logger } from "@/lib/core/logger"
import { TokenDataOfNetwork } from '@/lib/core/token-manager'
import { ethers } from 'ethers'
import type { TransactionSummary } from '@/types'

/**
 * 交易服务类
 * 纯业务逻辑，接收外部依赖
 */
export class TransactionService {
  // 移除 APIKeyManager，使用专门的 Swaps API 路由

  /**
   * 将配置中的 alphaStartDate 解析为北京时间(UTC+8) 起始时间。
   * 支持两种输入：
   * 1) YYYY-MM-DD               → 当日 08:00(+08:00)
   * 2) YYYY-MM-DD HH:mm[[:ss]]  → 当日指定时刻(+08:00)
   * 若字符串本身已带时区（Z 或 ±HH:MM），则按其自身时区解析。
   */
  private static parseAlphaStartAt(alphaStartDate?: string): Date | null {
    if (!alphaStartDate) return null
    try {
      const raw = alphaStartDate.trim()

      const dateOnlyRe = /^\d{4}-\d{2}-\d{2}$/
      const dateTimeRe = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/
      const hasTZ = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)

      let isoLike: string

      if (dateOnlyRe.test(raw)) {
        // 仅日期：默认 08:00(+08:00)
        isoLike = `${raw}T08:00:00+08:00`
      } else if (dateTimeRe.test(raw)) {
        // 含时间但无时区：默认补 +08:00，并保证有秒
        let normalized = raw.replace(' ', 'T')
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
          normalized += ':00'
        }
        isoLike = hasTZ ? normalized : `${normalized}+08:00`
      } else {
        // 其它格式：尽量标准化并假定 +08:00（若无时区）
        let normalized = raw.replace(' ', 'T')
        isoLike = hasTZ ? normalized : `${normalized}+08:00`
      }

      const d = new Date(isoLike)
      if (isNaN(d.getTime())) return null
      return d
    } catch {
      return null
    }
  }

  /**
   * 判定一笔买入交易是否处于 Alpha 窗口
   */
  private static isWithinAlphaWindow(txTimestampISO: string, alphaStartDate: string, windowDays: number): boolean {
    const startAt = TransactionService.parseAlphaStartAt(alphaStartDate)
    if (!startAt) return false
    const endAt = new Date(startAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
    const txTime = new Date(txTimestampISO)
    return txTime >= startAt && txTime < endAt
  }

  /**
   * 获取该笔买入交易应使用的倍数
   * 规则:
   * - 若买入的代币配置了 alphaStartDate 且在窗口内: 使用网络的 alphaBonusMultiplier
   * - 否则: 使用 baseMultiplier (默认 1)
   */
  private static getMultiplierForBuyTx(tokenData: TokenDataOfNetwork, tx: any): number {
    const rules = tokenData.rules
    const baseMultiplier = rules?.baseMultiplier ?? 1

    const buySymbol = tx?.bought?.symbol
    if (!buySymbol) return baseMultiplier

    const tokenInfo = tokenData.erc20Tokens?.[buySymbol]
    const alphaStartDate = tokenInfo?.alphaStartDate
    if (!alphaStartDate) return baseMultiplier

    const inWindow = TransactionService.isWithinAlphaWindow(tx.blockTimestamp, alphaStartDate, rules.alphaWindowDays)
    const multiplier = inWindow ? (rules.alphaBonusMultiplier ?? baseMultiplier) : baseMultiplier

    // 记录倍数选择，便于排查
    try {
      const reason = inWindow ? 'alpha-window' : 'base'
      logger.debug('multiplier', `🎚️ ${tokenData.network} ${buySymbol}: m=${multiplier} (${reason}) tx=${tx.transactionHash}`)
    } catch {}

    return multiplier
  }

  /**
   * 获取钱包交易汇总数据
   * @param walletAddress 钱包地址
   * @param moralisInstance Moralis 实例
   * @param httpClient HTTP 客户端实例
   * @param tokenDataOfNetworks 代币网络数据（外部传入，区块范围已缓存在内）
   * @param networkId 可选网络ID，不指定则使用主网络
   * @param limit 单次查询限制（默认100）
   * @returns 交易汇总结果
   */
  static async getWalletTransactions(
    walletAddress: string,
    moralisInstance: any,
    httpClient: any,
    tokenDataOfNetworks: { [networkId: string]: TokenDataOfNetwork },
    networkId?: string,
    limit: number = 100
  ): Promise<TransactionSummary> {
    // 跟踪API调用状态
    let hasApiError = false
    let errorMessage = ''

    try {
      for (const tokenData of Object.values(tokenDataOfNetworks)) {
        const network = tokenData.network
        const blockRange = tokenData.blockRanges
        logger.debug('general', `🧱 网络 ${tokenData.network}: ${blockRange?.startBlock} - ${blockRange?.endBlock}`)

        try {
          // 使用传入的 HTTP 客户端直接调用 Moralis API
          const params = new URLSearchParams({
            chain: tokenData.chainIdHex,
            fromBlock: blockRange?.startBlock?.toString() || '',
            toBlock: blockRange?.endBlock?.toString() || '',
            order: 'ASC'
          })
          const url = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/swaps?${params.toString()}`

          logger.debug('general', `🔄 直接调用 Moralis Swaps API: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`)

          const response = await httpClient.get(url)

          if (!response.ok) {
            throw new Error(`Swaps API 请求失败: ${response.status} ${response.statusText}`)
          }

          const result = await response.json()
          if (!result || typeof result !== 'object') {
            throw new Error('API 返回数据格式错误')
          }

          // logger.debug('general', `🔍 交易数据: ${JSON.stringify(result)}`)

          // 获取所有符合的交易
          let allFilteredTransactions: any[] = []

          // 遍历获取到的交易数据并过滤
          if (result.result && Array.isArray(result.result)) {
            // 获取当前网络的可用交易对
            const availablePairs = Object.keys(tokenData.pairs)

            // 过滤符合配置的交易 - 直接比较pairLabel
            allFilteredTransactions = result.result.filter((txData: any) => {
              return tokenData.pairs.hasOwnProperty(txData.pairLabel)
            })

            logger.debug('general', `📊 所有交易: ${allFilteredTransactions.length} 笔`)
          }

          // 如果找到了交易数据，处理并返回
          if (allFilteredTransactions.length > 0) {
            // 计算所有买入和卖出交易的差值
            let allTransactionLossValue = 0
            let allGasLossValue = 0

            // 分离买入和卖出交易
            const buyTransactions = allFilteredTransactions.filter((tx: any) => tx.transactionType === 'buy')
            const sellTransactions = allFilteredTransactions.filter((tx: any) => tx.transactionType === 'sell')

            logger.debug('general', `📊 交易统计: 总交易${allFilteredTransactions.length}笔, 买入${buyTransactions.length}笔, 卖出${sellTransactions.length}笔`)

            // 打印所有交易的详细信息
            allFilteredTransactions.forEach((tx: any, index: number) => {
              logger.debug('general', `交易${index + 1}: ${tx.transactionType} ${tx.pairLabel} totalValueUsd=$${tx.totalValueUsd.toFixed(6)}`)
              logger.debug('general', `  - bought: ${tx.bought?.symbol} ${tx.bought?.amount} ($${tx.bought?.usdAmount?.toFixed(6) || 'N/A'})`)
              logger.debug('general', `  - sold: ${tx.sold?.symbol} ${tx.sold?.amount} ($${tx.sold?.usdAmount?.toFixed(6) || 'N/A'})`)
              logger.debug('general', `  - 交易哈希: ${tx.transactionHash}`)
            })

            // 处理未完成交易：如果最后一笔是买入且买入数量比卖出多，则忽略最后一笔买入
            let completeBuyTransactions = buyTransactions
            let ignoredBuyValue = 0

            if (allFilteredTransactions.length > 0) {
              const lastTransaction = allFilteredTransactions[allFilteredTransactions.length - 1]
              if (lastTransaction.transactionType === 'buy' && buyTransactions.length > sellTransactions.length) {
                // 忽略最后一笔买入交易，不是完整的买入卖出对
                completeBuyTransactions = buyTransactions.slice(0, -1)
                ignoredBuyValue = lastTransaction.totalValueUsd
                logger.debug('general', `⏳ 忽略未完成的买入交易: $${ignoredBuyValue.toFixed(2)}`)
              }
            }

            // 计算实际的 USDT 流入流出
            // 买入交易：花费的 USDT（sold.usdAmount 的绝对值）
            const totalUsdtSpent = completeBuyTransactions.reduce((sum: number, tx: any) => {
              // 买入交易中，sold 是花费的 USDT（负数），取绝对值
              return sum + Math.abs(tx.sold?.usdAmount || 0)
            }, 0)

            // 卖出交易：得到的 USDT（bought.usdAmount）
            const totalUsdtReceived = sellTransactions.reduce((sum: number, tx: any) => {
              // 卖出交易中，bought 是得到的 USDT（正数）
              return sum + (tx.bought?.usdAmount || 0)
            }, 0)

            // 交易磨损 = 花费的 USDT - 得到的 USDT
            allTransactionLossValue = totalUsdtSpent - totalUsdtReceived

            logger.debug('general', `💰 交易磨损: $${allTransactionLossValue.toFixed(2)} (花费USDT: $${totalUsdtSpent.toFixed(2)} - 得到USDT: $${totalUsdtReceived.toFixed(2)})${ignoredBuyValue > 0 ? ` [忽略未完成: $${ignoredBuyValue.toFixed(2)}]` : ''}`)

            // 计算gas磨损
            try {
              // 使用第一笔交易的哈希来计算gas
              const transactionHash = allFilteredTransactions[0].transactionHash
              const gas = await TransactionService.getTransactionGas(httpClient, tokenData.chainIdHex, transactionHash)
              const nativeTokenPrice = tokenData.nativeToken.price || 0
              allGasLossValue = Number(ethers.formatEther(gas.toString())) * nativeTokenPrice * allFilteredTransactions.length
              logger.debug('general', `💰 gas磨损: $${allGasLossValue.toFixed(2)} 获取一笔交易的gas,然后乘以交易笔数`)
            } catch (error) {
              logger.debug('general', `❌ 计算gas磨损失败: ${error}`)
            }

            // 获取并处理买入交易（有效交易）
            const buyFilteredTransactions = allFilteredTransactions.filter((tx: any) => tx.transactionType === 'buy')
            logger.debug('general', `📈 有效交易: ${buyFilteredTransactions.length} 笔`)

            const transactionSummary = {
              allTransactionsCount: allFilteredTransactions.length,
              allTransactionLossValue,
              allGasLossValue,
              buyTransactionsCount: buyFilteredTransactions.length,
              buyTransactions: buyFilteredTransactions
                .map((tx: any) => {
                  // 直接使用blockTimestamp，不额外加8小时（因为API返回的可能已经是正确的时间）
                  const date = new Date(tx.blockTimestamp);
                  const beijingTime = date.toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                  });
                  return {
                    transactionHash: tx.transactionHash,
                    pairLabel: tx.pairLabel,
                    buySymbol: tx.bought.symbol,
                    sellSymbol: tx.sold.symbol,
                    buyAmount: tx.bought.amount,
                    sellAmount: tx.sold.amount,
                    time: beijingTime,
                    blockNumber: tx.blockNumber,
                    totalValueUsd: tx.totalValueUsd,
                    timestamp: new Date(tx.blockTimestamp).getTime(), // 添加时间戳用于排序
                  }
                })
                .sort((a, b) => b.timestamp - a.timestamp), // 按时间戳降序排列（最新的在前）
              // 按逐笔动态倍数计算有效交易量
              totalBoughtValue: buyFilteredTransactions.reduce((sum: number, tx: any) => {
                const usd = tx.bought?.usdAmount || 0
                const m = TransactionService.getMultiplierForBuyTx(tokenData, tx)
                return sum + usd * m
              }, 0),
            }

            if (buyFilteredTransactions.length > 0) {
              logger.debug('general', `💰 有效交易总价值: $${transactionSummary.totalBoughtValue.toFixed(2)}`)
            }

            // 返回处理后的数据
            return {
              ...transactionSummary,
              hasApiError,
              errorMessage: hasApiError ? errorMessage : undefined
            }
          }
        } catch (error) {
          hasApiError = true
          errorMessage = `查询交易数据失败: ${error}`
          logger.debug('general', `❌ ${errorMessage}`)
          // 继续处理下一个网络，不要立即返回
        }
      }
    } catch (error) {
      logger.debug('general', `❌ 钱包交易查询失败: ${error}`)
      throw error
    }

    // 如果没有找到任何数据，返回空的汇总结果
    return {
      allTransactionsCount: 0,
      allTransactionLossValue: 0,
      allGasLossValue: 0,
      buyTransactionsCount: 0,
      buyTransactions: [],
      totalBoughtValue: 0,
      hasApiError,
      errorMessage: hasApiError ? errorMessage : undefined
    }
  }

  /**
   * 获取单笔交易的gas费用（原生代币数量）
   * @param httpClient HTTP 客户端实例
   * @param chainIdHex 链ID（十六进制）
   * @param transactionHash 交易哈希
   * @returns gas费用（原生代币数量）
   */
  static async getTransactionGas(httpClient: any, chainIdHex: string, transactionHash: string): Promise<number> {
    try {
      // 使用 HTTP 客户端直接调用 Moralis Transaction API
      const params = new URLSearchParams({
        chain: chainIdHex
      })
      const url = `https://deep-index.moralis.io/api/v2.2/transaction/${transactionHash}?${params.toString()}`

      logger.debug('general', `🔄 直接调用 Moralis Transaction API: ${transactionHash.slice(0, 10)}...`)

      const response = await httpClient.get(url)

      if (!response.ok) {
        throw new Error(`Transaction API 请求失败: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      if (!result || typeof result !== 'object') {
        throw new Error('Transaction API 返回数据格式错误')
      }

      const { receipt_gas_used, gas_price } = result
      if (!receipt_gas_used || !gas_price) {
        logger.debug('general', `❌ 获取交易数据失败: gas数据不完整`)
        return 0
      }
      const gas = (parseInt(receipt_gas_used) * parseInt(gas_price))
      logger.debug('general', `💰 交易 ${transactionHash.slice(0, 10)}... gas费用: ${gas}`)
      return gas
    } catch (error) {
      logger.debug('general', `❌ 获取交易gas失败: ${error}`)
      return 0
    }
  }
}
