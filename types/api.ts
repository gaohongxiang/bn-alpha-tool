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

// 基础API响应类型（简化版，用于基本API调用）
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  responseTime?: number
  keyUsed?: string
}

// 增强API响应类型（用于复杂API系统）
export interface EnhancedAPIResponse<T = any> {
  success: boolean
  data: T
  error?: {
    code: string | number
    message: string
    details?: any
  }
  timestamp: number
  metadata?: {
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
  contractAddress?: string
}

// API错误类型
export interface APIError {
  code: string | number
  message: string
  details?: any
  isRetryable?: boolean
}

// 速率限制错误
export interface RateLimitError extends APIError {
  retryAfter?: number
}