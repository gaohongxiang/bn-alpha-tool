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
            // 计算第一笔和最后一笔交易的差值
            let allTransactionLossValue = 0
            let allGasLossValue = 0

            const firstTransaction = allFilteredTransactions[0]
            const lastTransaction = allFilteredTransactions[allFilteredTransactions.length - 1]
            allTransactionLossValue = firstTransaction.totalValueUsd - lastTransaction.totalValueUsd

            logger.debug('general', `💰 交易磨损: $${allTransactionLossValue.toFixed(2)} (第一笔 - 最后一笔)`)

            // 计算gas磨损
            try {
              // 使用第一笔交易的哈希来计算gas
              const transactionHash = firstTransaction.transactionHash
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
              buyTransactions: buyFilteredTransactions.map((tx: any) => {
                // 转换为北京时间格式
                const date = new Date(new Date(tx.blockTimestamp).getTime() + 8 * 3600 * 1000);
                const beijingTime = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
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
                }
              }),
              // 根据配置文件中的volumeMultiplier计算交易量
              totalBoughtValue: buyFilteredTransactions.reduce((sum: number, tx: any) => sum + tx.bought.usdAmount, 0) * tokenData.volumeMultiplier,
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
