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
  note: string
  totalBalance: number
  tokenBalances: TokenBalance[]
  tradingVolume: number
  transactionCount: number
  estimatedPoints: number
  revenue: number
  gasUsed: number
  tradingLoss: number
  gasLoss: number
  isLoading?: boolean
  error?: string
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