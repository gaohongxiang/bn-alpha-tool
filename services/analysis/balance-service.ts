import type { TokenBalance, BalanceQueryResult, ExchangeTransaction } from '@/types'
import { ethers } from "ethers"
import { BSCScanService } from '../api/bscscan-service'
import { TokenPriceUtils } from '../../lib/utils/token-price-utils'
import { TimeUtils } from '../../lib/utils/time-utils'
import { configManager } from '../../lib/config-manager'
import { DebugLogger } from '../../lib/debug-logger'

/**
 * 余额分析服务
 * 负责获取钱包在指定时间点的代币余额
 */
export class BalanceService {
  private static instance: BalanceService
  private bscscanService: BSCScanService

  private constructor() {
    this.bscscanService = BSCScanService.getInstance()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): BalanceService {
    if (!BalanceService.instance) {
      BalanceService.instance = new BalanceService()
    }
    return BalanceService.instance
  }

  /**
   * 获取钱包在指定日期的余额
   * @param address 钱包地址
   * @param queryDate 查询日期 (YYYY-MM-DD)
   * @param sharedData 可选的共享数据，用于避免重复查询
   * @returns 余额查询结果
   */
  async getWalletBalance(
    address: string, 
    queryDate: string,
    sharedData?: {
      blockRange?: { startBlock: number; endBlock: number; endTimestamp: number };
      bnbPrice?: number;
      priceMap?: { [symbol: string]: number };
    }
  ): Promise<BalanceQueryResult> {
    try {
      DebugLogger.log('余额', `开始查询钱包余额: ${address} (${queryDate})`)

      // 获取当前网络配置
      const networkConfig = configManager.getCurrentNetworkConfig()
      if (!networkConfig) {
        throw new Error('网络配置未找到')
      }

      // 判断查询策略
      const dayTimeRange = TimeUtils.getDayTimeRange(queryDate)
      const isHistoricalQuery = dayTimeRange.isCompleted
      const queryStrategy = isHistoricalQuery ? 'historical' : 'current'
      
      DebugLogger.log('余额', `查询策略: ${queryStrategy} (${queryDate})`)

      let balanceTag: string
      let balanceBlockNumber: number | undefined

      if (isHistoricalQuery) {
        // 历史查询：优先使用共享的区块范围
        if (sharedData?.blockRange) {
          balanceBlockNumber = sharedData.blockRange.endBlock
          balanceTag = balanceBlockNumber.toString()
          DebugLogger.log('余额', `使用共享的历史区块 ${balanceBlockNumber} (${new Date(sharedData.blockRange.endTimestamp * 1000).toLocaleString()})`)
        } else {
          // 回退到单独查询
          try {
            balanceBlockNumber = await TimeUtils.getBlockByTimestamp(dayTimeRange.endTimestamp, 'before', 0)
            balanceTag = balanceBlockNumber.toString()
            DebugLogger.log('余额', `使用历史区块 ${balanceBlockNumber} (${new Date(dayTimeRange.endTimestamp * 1000).toLocaleString()})`)
          } catch (error) {
            DebugLogger.log('警告', `获取历史区块失败，使用当前余额: ${error}`)
            balanceTag = 'latest'
          }
        }
      } else {
        // 当前查询：使用最新余额
        balanceTag = 'latest'
        DebugLogger.log('余额', `使用当前余额 (latest)`)
      }

      const tokenBalances: TokenBalance[] = []

      // 获取原生代币余额 (BNB)
      const bnbBalance = await this.getBNBBalance(address, balanceBlockNumber)
      tokenBalances.push({
        symbol: "BNB",
        balance: Number(ethers.formatEther(bnbBalance.balance)),
        usdValue: 0, // 将在后续统一计算USD价值
      })

      // 获取所有配置的代币余额
      const tokenConfigs = configManager.getTokens()
      const tokenRequests = tokenConfigs
        .filter(token => token.address !== 'native') // 排除原生代币
        .map(async (tokenConfig) => {
          try {
            // BSCScan免费API不支持历史区块查询，统一使用latest
            const response = await this.bscscanService.getTokenBalance(
              tokenConfig.address,
              address,
              'latest'
            )

            if (response.success && response.data?.status === "1" && response.data.result !== "0") {
              const decimals = 18 // 大部分BSC代币都是18位小数
              const balance = Number.parseFloat(ethers.formatUnits(response.data.result, decimals))

              if (balance > 0) {
                let usdValue = 0
                if (tokenConfig.isStableCoin) {
                  usdValue = balance // 稳定币按1:1计算
                } else {
                  usdValue = 0 // 非稳定币后续计算
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
            DebugLogger.log('错误', `获取${tokenConfig.symbol}余额失败: ${error}`)
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

      // 为非稳定币计算USD价值（使用共享的BNB价格和价格映射表）
      await this.calculateTokenUSDValues(
        tokenBalances, 
        address, 
        queryDate, 
        sharedData?.bnbPrice,
        sharedData?.priceMap
      )

      // 计算总USD价值
      const totalUsdValue = tokenBalances.reduce((sum, token) => sum + token.usdValue, 0)

      DebugLogger.log('余额', `余额查询完成: ${tokenBalances.length}种代币，总价值 $${totalUsdValue.toFixed(2)}`)

      return {
        address,
        queryDate,
        queryStrategy,
        balanceTag,
        blockNumber: bnbBalance.blockNumber,
        tokenBalances,
        totalUsdValue,
        timestamp: Date.now()
      }

    } catch (error) {
      DebugLogger.log('错误', `获取钱包余额失败: ${error}`)
      throw error
    }
  }

  /**
   * 为代币余额计算USD价值（使用共享价格映射表）
   */
  private async calculateTokenUSDValues(
    tokenBalances: TokenBalance[], 
    address: string, 
    queryDate: string,
    sharedBnbPrice?: number,
    sharedPriceMap?: { [symbol: string]: number }
  ): Promise<void> {
    try {
      DebugLogger.log('价格', `开始计算代币USD价值`)
      
      // 使用传入的共享价格映射表
      let priceMap: { [symbol: string]: number } = sharedPriceMap || {}
      
      if (Object.keys(priceMap).length > 0) {
        DebugLogger.log('价格', `✅ 使用共享价格映射表，包含 ${Object.keys(priceMap).length} 个代币价格`)
      } else {
        DebugLogger.log('价格', `⚠️ 未提供共享价格映射表，将只计算BNB和稳定币价值`)
        priceMap = {}
      }
      
      // 为每个代币计算USD价值
      for (const token of tokenBalances) {
        if (token.usdValue === 0 && token.balance > 0) {
          try {
            let price = 0
            
            if (token.symbol === 'BNB') {
              // BNB优先使用共享价格，避免重复查询
              if (sharedBnbPrice && sharedBnbPrice > 0) {
                price = sharedBnbPrice
                DebugLogger.log('价格', `使用共享BNB价格: $${price}`)
              } else {
                price = await TokenPriceUtils.getCurrentBNBPrice()
                DebugLogger.log('价格', `查询BNB价格: $${price}`)
              }
            } else {
              // 其他代币从共享价格映射表获取
              price = priceMap[token.symbol] || 0
              if (price > 0) {
                DebugLogger.log('价格', `从共享映射表获取 ${token.symbol} 价格: $${price}`)
              } else {
                // 如果共享映射表中没有，尝试从TokenPriceUtils的基础价格获取
                if (['USDT', 'USDC', 'BUSD', 'DAI'].includes(token.symbol)) {
                  price = 1 // 稳定币
                  DebugLogger.log('价格', `${token.symbol} 为稳定币，价格: $${price}`)
                } else {
                  DebugLogger.log('价格', `⚠️ ${token.symbol} 在共享映射表中未找到价格，可能需要更新价格推算逻辑`)
                }
              }
            }
            
            token.usdValue = token.balance * price
            
            if (price > 0) {
              DebugLogger.log('价格', `✅ ${token.symbol}: ${token.balance.toFixed(6)} × $${price.toFixed(6)} = $${token.usdValue.toFixed(2)}`)
              
              // 为ERC20代币添加更详细的价格信息到token对象中
              if (token.symbol !== 'BNB' && !['USDT', 'USDC', 'BUSD', 'DAI'].includes(token.symbol)) {
                DebugLogger.log('价格', `🔸 ERC20代币 ${token.symbol} 价格来源: 共享价格映射表`)
              }
            } else {
              DebugLogger.log('价格', `⚠️ ${token.symbol}: ${token.balance.toFixed(6)} × $0 = $0 (无价格数据)`)
              
              // 提示用户为什么没有价格数据
              if (!['USDT', 'USDC', 'BUSD', 'DAI'].includes(token.symbol) && token.symbol !== 'BNB') {
                DebugLogger.log('价格', `💡 建议: ${token.symbol} 代币可能需要有交易记录才能推算价格`)
              }
            }
          } catch (error) {
            DebugLogger.log('错误', `计算 ${token.symbol} USD价值失败: ${error}`)
          }
        }
      }
    } catch (error) {
      DebugLogger.log('错误', `计算代币USD价值失败: ${error}`)
    }
  }

  /**
   * 获取钱包BNB余额
   */
  private async getBNBBalance(
    address: string, 
    blockNumber?: number
  ): Promise<{ balance: bigint; blockNumber: number }> {
    try {
      // BSCScan免费API不支持历史区块查询，统一使用latest
      const tag = 'latest'
      DebugLogger.log(`🔍 查询BNB余额: ${address} (tag: ${tag})`)
      
      const response = await this.bscscanService.getBalance(address, tag)

      if (!response.success || !response.data) {
        throw new Error(`获取BNB余额失败: ${response.error || '未知错误'}`)
      }

      const balanceWei = BigInt(response.data.result || '0')
      
      // 获取当前区块号
      const currentBlockResponse = await this.bscscanService.getLatestBlockNumber()
      
      let currentBlock = 0
      if (currentBlockResponse.success && currentBlockResponse.data?.result) {
        currentBlock = parseInt(currentBlockResponse.data.result, 16)
      }

      DebugLogger.log(`✅ BNB余额查询成功: ${balanceWei.toString()} wei (区块: ${currentBlock})`)
      
      return {
        balance: balanceWei,
        blockNumber: currentBlock
      }
    } catch (error) {
      DebugLogger.error(`❌ 获取${address}的BNB余额失败:`, error)
      throw error
    }
  }

  /**
   * 计算用于积分的余额（统计所有有USD价值的代币）
   */
  static calculatePointsBalance(tokenBalances: TokenBalance[]): number {
    return tokenBalances
      .filter(token => token.usdValue > 0)
      .reduce((total, token) => total + token.usdValue, 0)
  }

  /**
   * 批量获取多个钱包的余额
   */
  async getBatchWalletBalances(addresses: string[], queryDate: string): Promise<BalanceQueryResult[]> {
    DebugLogger.log('余额', `开始批量查询 ${addresses.length} 个钱包余额`)
    
    const results: BalanceQueryResult[] = []
    
    // 并行查询所有钱包余额
    const promises = addresses.map(async (address, index) => {
      try {
        DebugLogger.log('余额', `查询钱包 ${index + 1}/${addresses.length}: ${address}`)
        const result = await this.getWalletBalance(address, queryDate)
        return result
      } catch (error) {
        DebugLogger.log('错误', `钱包 ${index + 1} 余额查询失败: ${error}`)
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
    
    DebugLogger.log('余额', `批量余额查询完成: ${successCount}/${addresses.length} 成功，总价值 $${totalValue.toFixed(2)}`)
    
    return results
  }


} 