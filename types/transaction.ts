/**
 * 交易相关类型定义
 */

export interface RawTransaction {
  hash: string
  from: string
  to: string
  value: string
  tokenSymbol: string
  tokenName: string
  tokenDecimal: string
  blockNumber: string
  timeStamp: string
  gasUsed?: string
  gasPrice?: string
}

export interface ExchangeTransaction {
  hash: string
  blockNumber: number
  timestamp: number
  fromToken: string
  toToken: string
  fromAmount: number
  toAmount: number
  gasUsed: number
  gasPrice: number
  gasCost: number
}

export interface TradingLoss {
  totalSold: number
  totalBought: number
  lossAmount: number
  lossValue: number
  tokenSymbol: string
}

export interface GasLoss {
  totalGasUsed: number
  totalGasCost: number
  totalGasValue: number
  bnbPrice: number
}

export interface ValidTransactions {
  count: number
  volume: number
  transactions: ExchangeTransaction[]
}

export interface AllExchanges {
  count: number
  transactions: ExchangeTransaction[]
}

export interface TradingLossResult {
  tradingLoss: TradingLoss
  gasLoss: GasLoss
  validTransactions: ValidTransactions
  allExchanges: AllExchanges
}

export interface BlockRange {
  startBlock: number
  endBlock: number
  startTimestamp: number
  endTimestamp: number
}

export interface DayTimeRange {
  startTimestamp: number // 当天开始时间戳 (UTC+8 8:00)
  endTimestamp: number   // 当天结束时间戳 (UTC+8 7:59:59)
  dayStr: string         // 日期字符串 (YYYY-MM-DD)
  isCompleted: boolean   // 当天是否已结束
}

export interface TransactionTimeInfo {
  firstTransactionTime?: number  // 首笔有效交易时间
  lastTransactionTime?: number   // 最后一笔有效交易时间
  dayRange: DayTimeRange         // 当天时间范围
}

export interface TradingPairAnalysisResult {
  pairDescription: string
  blockRange: BlockRange
  walletAddress: string
  result: TradingLossResult
  logs: string[]
} 