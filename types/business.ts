/**
 * 业务逻辑相关类型定义
 * 包含批量查询、API系统等业务特定类型
 */

import type { TokenDataOfNetwork } from '@/lib/core/token-manager'

// 批量查询配置
export interface BatchQueryConfig {
  batchSize: number
  concurrency: number
  retryAttempts: number
  timeoutPerBatch?: number
  progressCallback?: (progress: number) => void
}

// 钱包数据查询参数
export interface WalletQueryParams {
  address: string
  chainId: string
  tokenData: TokenDataOfNetwork
  startBlock?: number
  endBlock?: number
  startDate?: string
  endDate?: string
}

// API密钥统计信息
export interface APIKeyStats {
  total: number
  failed: number
  current: number
  lastUsed: number
  errorCount: number
  successCount: number
}

// API密钥信息
export interface APIKeyInfo {
  key: string
  stats: APIKeyStats
  isActive: boolean
  lastError?: string
  lastSuccess?: number
}

// 请求队列项
export interface QueueItem<T = any> {
  id: string
  request: () => Promise<T>
  priority: number
  timestamp: number
  resolve: (value: T) => void
  reject: (reason: any) => void
  retryCount: number
  timeout: number
}

// 健康检查配置
export interface HealthCheckConfig {
  enabled: boolean
  interval: number
  timeout: number
  retries: number
  endpoints?: string[]
}

// 缓存配置
export interface CacheConfig {
  ttl: number
  maxSize: number
  namespace?: string
  storage?: 'memory' | 'localStorage' | 'redis'
}

// 增强缓存配置
export interface EnhancedCacheConfig extends CacheConfig {
  compression?: boolean
  encryption?: boolean
  persistToDisk?: boolean
  cleanupStrategy?: 'lru' | 'ttl' | 'manual'
}

// API响应元数据
export interface APIResponseMetadata {
  requestId?: string
  processingTime?: number
  rateLimit?: {
    limit: number
    remaining: number
    reset: number
  }
  pagination?: {
    page: number
    pageSize: number
    total: number
    hasMore: boolean
  }
}

// 监控配置
export interface MonitoringConfig {
  enabled: boolean
  metricsInterval: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  exportMetrics?: boolean
}

// 熔断器配置
export interface CircuitBreakerConfig {
  enabled: boolean
  failureThreshold: number
  resetTimeout: number
}

// API系统配置
export interface APISystemConfig {
  healthCheck?: HealthCheckConfig
  cache?: EnhancedCacheConfig
  monitoring?: MonitoringConfig
  circuitBreaker?: CircuitBreakerConfig
}

// 请求函数类型
export type RequestFunction<T = any> = () => Promise<T>

// 交易汇总结果接口
export interface TransactionSummary {
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
  hasApiError?: boolean      // 是否有API调用失败
  errorMessage?: string      // 错误信息
}

// 点数计算结果
export interface PointsCalculationResult {
  balancePoints: number
  volumePoints: number
  totalPoints: number
  breakdown?: {
    [tokenSymbol: string]: {
      balance: number
      balancePoints: number
      volume?: number
      volumePoints?: number
    }
  }
}

// 区块范围查询结果
export interface BlockRangeResult {
  startBlock: number
  endBlock: number
  startTimestamp: number
  endTimestamp: number
  network: string
  cached: boolean
}
