/**
 * API相关类型定义
 */

export interface APIKey {
  key: string
  name: string
  active: boolean
  priority: number
  comment?: string
  isDefault?: boolean
  protected?: boolean
}

export interface APIHealth {
  keyIndex: number
  lastUsed: number
  errorCount: number
  avgResponseTime: number
  isHealthy: boolean
}

export interface APIRequest {
  url: string
  retryCount?: number
  timeoutMs?: number
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  responseTime?: number
  keyUsed?: string
}

export interface RateLimitConfig {
  requestsPerSecond: number
  requestsPerDay: number
  note?: string
}

export interface NetworkAPI {
  baseUrl: string
  rateLimit: RateLimitConfig
  keys: APIKey[]
}

export interface BSCScanResponse<T = any> {
  status: "0" | "1"
  message: string
  result: T
}

export interface BSCScanTransaction {
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