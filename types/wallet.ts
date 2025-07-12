import type { TransactionSummary } from "./business"

/**
 * 钱包相关类型定义
 */

export interface Wallet {
  address: string
  note: string
}

export interface TokenBalance {
  symbol: string
  balance: number
  usdValue: number
  contractAddress?: string
}

export interface WalletData {
  address: string
  note?: string  // 改为可选，与新的 API 结构一致

  // 余额相关
  tokensValue: number
  totalBalance?: number  // 兼容旧版本
  tokenBalances?: TokenBalance[]  // 代币余额列表

  // 交易相关
  transactionData?: {
    allTransactionsCount: number
    allTransactionLossValue: number
    allGasLossValue: number
    buyTransactionsCount: number
    buyTransactions: Array<{
      transactionHash: string
      pairLabel: string
      buySymbol: string
      sellSymbol: string
      buyAmount: string
      sellAmount: string
      time: string
      blockNumber: number
      totalValueUsd: number
    }>
    totalBoughtValue: number
  }

  // 交易统计（兼容旧版本）
  tradingVolume?: number
  transactionCount?: number
  tradingLoss?: number
  gasLoss?: number
  gasUsed?: number
  revenue?: number
  estimatedPoints?: number

  // 积分相关
  points: number
  balancePoints: number
  volumePoints: number

  error?: string
  // 移除 isLoading，新架构不需要
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