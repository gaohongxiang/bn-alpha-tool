/**
 * 配置相关类型定义
 */

export interface TokenConfig {
  symbol: string
  name: string
  aliases?: string[]
  isStableCoin?: boolean
  basePrice?: number
  address: string
}

export interface TradingPairConfig {
  from: string
  to: string
  description?: string
}

export interface TradingRules {
  bscVolumeMultiplier: number
  defaultGasPrice: string
  defaultGasLimit: number
}

export interface APIConfig {
  baseUrl: string
  keys: Array<{
    key: string
    name: string
    active: boolean
  }>
}

export interface NetworkConfig {
  name: string
  chainId: number
  rpcUrls: string[]
  blockExplorerUrl: string
  tokens: TokenConfig[]
  pairs: TradingPairConfig[]
  rules: TradingRules
  api: APIConfig
}

export interface AppConfig {
  networks: {
    [networkId: string]: NetworkConfig
  }
  defaultNetwork: string
  _meta?: {
    description: string
    lastUpdated: string
  }
}

export interface AirdropData {
  date: string
  token: string
  points?: number
  phase1Points?: number
  phase2Points?: number
  participants: number | null
  amount: number
  supplementaryToken: number
  currentPrice: string
  type: 'airdrop' | 'tge' | 'preTge' | 'bondingCurveTge'
  startTime?: string
  endTime?: string
  phase1EndTime?: string
  phase2EndTime?: string
} 