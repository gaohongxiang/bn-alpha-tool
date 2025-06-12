/**
 * 余额管理器
 * 负责获取钱包在指定时间点的代币余额
 */

import { ethers } from "ethers"
import { apiManager } from "./api-manager"
import { configManager } from "../lib/config-manager"
import { TimeUtils } from "./time-utils"
import { LogManager } from "./log-manager"

export interface TokenBalance {
  symbol: string
  balance: number
  usdValue: number
  contractAddress?: string
}

export interface BalanceQueryResult {
  address: string
  queryDate: string
  queryStrategy: 'current' | 'historical'
  balanceTag: string
  blockNumber?: number
  tokenBalances: TokenBalance[]
  totalUsdValue: number
  timestamp: number
}

export class BalanceManager {
  private static bnbPrice: number = 600 // 默认BNB价格，应该从外部传入

  /**
   * 设置BNB价格
   */
  static setBNBPrice(price: number) {
    this.bnbPrice = price
  }

  /**
   * 获取钱包在指定日期的余额
   * @param address 钱包地址
   * @param queryDate 查询日期 (YYYY-MM-DD)
   * @returns 余额查询结果
   */
  static async getWalletBalance(address: string, queryDate: string): Promise<BalanceQueryResult> {
    try {
      LogManager.addLog('余额', `开始查询钱包余额: ${address} (${queryDate})`)

      // 获取当前网络配置
      const networkConfig = configManager.getCurrentNetworkConfig()
      if (!networkConfig) {
        throw new Error('网络配置未找到')
      }

      // 判断查询策略
      const dayTimeRange = TimeUtils.getDayTimeRange(queryDate)
      const isHistoricalQuery = dayTimeRange.isCompleted
      const queryStrategy = isHistoricalQuery ? 'historical' : 'current'
      
      LogManager.addLog('余额', `查询策略: ${queryStrategy} (${queryDate})`)

      let balanceTag: string
      let balanceBlockNumber: number | undefined

      if (isHistoricalQuery) {
        // 历史查询：使用当天结束时间对应的区块
        try {
          balanceBlockNumber = await TimeUtils.getBlockByTimestamp(dayTimeRange.endTimestamp, 'before', 0)
          balanceTag = balanceBlockNumber.toString()
          LogManager.addLog('余额', `使用历史区块 ${balanceBlockNumber} (${new Date(dayTimeRange.endTimestamp * 1000).toLocaleString()})`)
        } catch (error) {
          LogManager.addLog('警告', `获取历史区块失败，使用当前余额: ${error}`)
          balanceTag = 'latest'
        }
      } else {
        // 当前查询：使用最新余额
        balanceTag = 'latest'
        LogManager.addLog('余额', `使用当前余额 (latest)`)
      }

      const tokenBalances: TokenBalance[] = []

      // 获取原生代币余额 (BNB)
      const bnbBalance = await this.getBNBBalance(address, balanceTag)
      tokenBalances.push({
        symbol: "BNB",
        balance: bnbBalance,
        usdValue: 0, // 将在后续统一计算USD价值
      })

      // 获取所有配置的代币余额
      const tokenConfigs = configManager.getTokens()
      const tokenRequests = tokenConfigs
        .filter(token => token.address !== 'native') // 排除原生代币
        .map(async (tokenConfig) => {
          try {
            const response = await apiManager.makeRequest('bsc', 'bscscan', '', {
              module: 'account',
              action: 'tokenbalance',
              contractaddress: tokenConfig.address,
              address: address,
              tag: balanceTag
            })

            if (response.success && response.data?.status === "1" && response.data.result !== "0") {
              // 从配置中获取decimals，如果没有则使用默认值18
              const decimals = 18 // 大部分BSC代币都是18位小数
              const balance = Number.parseFloat(ethers.formatUnits(response.data.result, decimals))

              if (balance > 0) {
                let usdValue = 0
                if (tokenConfig.isStableCoin) {
                  usdValue = balance // 稳定币按1:1计算
                } else {
                  // 对于非稳定币，需要获取价格来计算USD价值
                  // 这里先设为0，后续会通过价格查询来更新
                  usdValue = 0
                }

                return {
                  symbol: tokenConfig.symbol,
                  balance,
                  usdValue,
                  contractAddress: tokenConfig.address,
                }
              }
            }
          } catch (error) {
            LogManager.addLog('错误', `获取${tokenConfig.symbol}余额失败: ${error}`)
          }
          return null
        })

      // 等待所有代币余额查询完成
      const tokenResults = await Promise.all(tokenRequests)

      // 添加有效的代币余额
      tokenResults.forEach(result => {
        if (result) {
          tokenBalances.push(result)
        }
      })

      // 为非稳定币计算USD价值
      await this.calculateTokenUSDValues(tokenBalances, address, queryDate)

      // 计算总USD价值
      const totalUsdValue = tokenBalances.reduce((sum, token) => sum + token.usdValue, 0)

      LogManager.addLog('余额', `余额查询完成: ${tokenBalances.length}种代币，总价值 $${totalUsdValue.toFixed(2)}`)

      return {
        address,
        queryDate,
        queryStrategy,
        balanceTag,
        blockNumber: balanceBlockNumber,
        tokenBalances,
        totalUsdValue,
        timestamp: Date.now()
      }

    } catch (error) {
      LogManager.addLog('错误', `获取钱包余额失败: ${error}`)
      throw error
    }
  }

    /**
   * 为代币余额计算USD价值（通过交易历史推算价格）
   * @param tokenBalances 代币余额列表
   * @param address 钱包地址
   * @param queryDate 查询日期
   */
  private static async calculateTokenUSDValues(tokenBalances: TokenBalance[], address: string, queryDate: string): Promise<void> {
    try {
      // 导入必要的工具类
      const { TokenPriceUtils } = await import('./token-price-utils')
      const { TradingPairAnalyzer } = await import('./transaction-analyzer')
      const { TimeUtils } = await import('./time-utils')
      
      LogManager.addLog('价格', `开始通过交易历史推算代币价格`)
      
      // 获取交易历史来推算代币价格
      let priceMap: { [symbol: string]: number } = {}
      
      try {
        // 获取当天的区块范围
        const blockRange = await TimeUtils.getBlockRangeByDate(queryDate, 0)
        LogManager.addLog('价格', `分析区块范围: ${blockRange.startBlock} - ${blockRange.endBlock}`)
        
        // 分析钱包交易历史
        const analyzer = new TradingPairAnalyzer(address)
        const analysisResult = await analyzer.analyzeInBlockRange(blockRange)
        
        // 从交易历史构建价格映射表
        const transactions = analysisResult.result.allExchanges.transactions.map(ex => ({
          fromToken: ex.fromToken,
          toToken: ex.toToken,
          fromAmount: ex.fromAmount,
          toAmount: ex.toAmount,
          timestamp: ex.timestamp,
          hash: ex.hash
        }))
        
        if (transactions.length > 0) {
          priceMap = await TokenPriceUtils.buildCompletePriceMap(transactions)
          LogManager.addLog('价格', `从 ${transactions.length} 笔交易推算出 ${Object.keys(priceMap).length} 个代币价格`)
          
          // 输出推算出的价格
          Object.entries(priceMap).forEach(([symbol, price]) => {
            if (price > 0) {
              LogManager.addLog('价格', `  ${symbol}: $${price.toFixed(6)}`)
            }
          })
        } else {
          LogManager.addLog('价格', `⚠️ 没有找到交易历史，无法推算代币价格`)
        }
      } catch (error) {
        LogManager.addLog('警告', `交易历史分析失败: ${error}`)
        priceMap = {}
      }
      
      // 为每个代币计算USD价值
      for (const token of tokenBalances) {
        if (token.usdValue === 0 && token.balance > 0) {
          try {
            let price = 0
            
            if (token.symbol === 'BNB') {
              // BNB使用实时价格
              price = await TokenPriceUtils.getCurrentBNBPrice()
            } else {
              // 其他代币从推算的价格映射表获取
              price = priceMap[token.symbol] || 0
            }
            
            token.usdValue = token.balance * price
            
            if (price > 0) {
              LogManager.addLog('价格', `✅ ${token.symbol}: ${token.balance.toFixed(6)} × $${price.toFixed(6)} = $${token.usdValue.toFixed(2)}`)
            } else {
              LogManager.addLog('价格', `⚠️ ${token.symbol}: ${token.balance.toFixed(6)} × $0 = $0 (无价格数据)`)
            }
          } catch (error) {
            LogManager.addLog('错误', `计算 ${token.symbol} USD价值失败: ${error}`)
          }
        }
      }
    } catch (error) {
      LogManager.addLog('错误', `计算代币USD价值失败: ${error}`)
    }
  }

  /**
   * 获取钱包BNB余额
   * @param address 钱包地址
   * @param tag 查询标签 ('latest' 或区块号)
   * @returns BNB余额
   */
  private static async getBNBBalance(address: string, tag: string = 'latest'): Promise<number> {
    try {
      const response = await apiManager.makeRequest('bsc', 'bscscan', '', {
        module: 'account',
        action: 'balance',
        address: address,
        tag: tag
      })

      if (response.success && response.data?.status === '1') {
        const balance = parseFloat(response.data.result) / 1e18 // Wei转BNB
        return balance
      } else {
        throw new Error(`获取BNB余额失败: ${response.error || response.data?.message}`)
      }
    } catch (error) {
      LogManager.addLog('错误', `获取${address}的BNB余额失败: ${error}`)
      throw error
    }
  }

  /**
   * 计算用于积分的余额（统计所有有USD价值的代币）
   * @param tokenBalances 代币余额列表
   * @returns 用于积分计算的USDT价值
   */
  static calculatePointsBalance(tokenBalances: TokenBalance[]): number {
    return tokenBalances
      .filter(token => token.usdValue > 0)
      .reduce((total, token) => total + token.usdValue, 0)
  }

  /**
   * 批量获取多个钱包的余额
   * @param addresses 钱包地址列表
   * @param queryDate 查询日期
   * @returns 余额查询结果列表
   */
  static async getBatchWalletBalances(addresses: string[], queryDate: string): Promise<BalanceQueryResult[]> {
    LogManager.addLog('余额', `开始批量查询 ${addresses.length} 个钱包余额`)
    
    const results: BalanceQueryResult[] = []
    
    // 并行查询所有钱包余额
    const promises = addresses.map(async (address, index) => {
      try {
        LogManager.addLog('余额', `查询钱包 ${index + 1}/${addresses.length}: ${address}`)
        const result = await this.getWalletBalance(address, queryDate)
        return result
      } catch (error) {
        LogManager.addLog('错误', `钱包 ${index + 1} 余额查询失败: ${error}`)
        // 返回错误结果
        return {
          address,
          queryDate,
          queryStrategy: 'current' as const,
          balanceTag: 'latest',
          tokenBalances: [],
          totalUsdValue: 0,
          timestamp: Date.now()
        }
      }
    })

    const batchResults = await Promise.all(promises)
    results.push(...batchResults)

    const successCount = results.filter(r => r.tokenBalances.length > 0).length
    const totalValue = results.reduce((sum, r) => sum + r.totalUsdValue, 0)
    
    LogManager.addLog('余额', `批量余额查询完成: ${successCount}/${addresses.length} 成功，总价值 $${totalValue.toFixed(2)}`)
    
    return results
  }
} 