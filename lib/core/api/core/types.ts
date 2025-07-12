// 导入统一的类型定义
import type {
    APIKeyStats,
    APIKeyInfo,
    QueueItem,
    BatchQueryConfig,
    WalletQueryParams,
    RequestFunction
} from '@/types/business'

import type { TokenDataOfNetwork } from '@/lib/core/token-manager'

// 重新导出业务类型，保持向后兼容
export type {
    APIKeyStats,
    APIKeyInfo,
    QueueItem,
    BatchQueryConfig,
    WalletQueryParams,
    RequestFunction,
    TokenDataOfNetwork
}

// 导入API相关类型
import type { EnhancedAPIResponse } from '@/types/api'

// 重新导出API响应类型，保持向后兼容
export type APIResponse<T> = EnhancedAPIResponse<T>

// 本地特定的配置类型（不与全局类型冲突）
export interface LocalRateLimitConfig {
    requestsPerSecond: number
    burstSize: number
    timeWindow: number
    maxTokens?: number
    refillRate?: number
}

export interface LocalErrorConfig {
    maxRetries: number
    baseDelay: number
    maxDelay: number
    retryableErrors?: string[]
    retryCondition?: (error: any) => boolean
}

export interface LocalAPIConfig {
    apiKeys: string[]
    rateLimit: LocalRateLimitConfig
    error: LocalErrorConfig
    timeout: number
    headers?: Record<string, string>
    baseURL?: string
}

export interface QueryManagerConfig {
    maxConcurrentRequests: number
    queueTimeout: number
    retryStrategy: 'linear' | 'exponential'
    priorityLevels?: number
    defaultPriority?: number
}

// 简化的批量配置（用于客户端）
export interface SimpleBatchConfig {
    batchSize?: number
    concurrency?: number
    retryAttempts?: number
    progressCallback?: (progress: number, completed: number, total: number) => void
}

// API错误类型
export class APIError extends Error {
    constructor(
        message: string,
        public code: string | number,
        public details?: any,
        public isRetryable: boolean = true
    ) {
        super(message)
        this.name = 'APIError'

        // 确保错误堆栈正确
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, APIError)
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            isRetryable: this.isRetryable,
            stack: this.stack
        }
    }
}

// 速率限制错误
export class RateLimitError extends APIError {
    constructor(
        message: string,
        public retryAfter?: number
    ) {
        super(message, 'RATE_LIMIT_ERROR', { retryAfter }, true)
        this.name = 'RateLimitError'
    }
}

// API密钥错误
export class APIKeyError extends APIError {
    constructor(message: string, details?: any) {
        super(message, 'API_KEY_ERROR', details, false) // API Key错误通常不可重试
        this.name = 'APIKeyError'
    }
}

// 超时错误
export class TimeoutError extends APIError {
    constructor(message: string, public timeout: number) {
        super(message, 'TIMEOUT_ERROR', { timeout }, true)
        this.name = 'TimeoutError'
    }
}

// 网络错误
export class NetworkError extends APIError {
    constructor(message: string, details?: any) {
        super(message, 'NETWORK_ERROR', details, true)
        this.name = 'NetworkError'
    }
}

// 并行查询配置
export interface ParallelQueryConfig extends LocalAPIConfig {
    maxConcurrentRequests: number
    queueTimeout: number
    retryStrategy: 'exponential' | 'linear' | 'none'
    priorityLevels: number
    defaultPriority: number
}

// 查询函数类型
export type QueryFunction<T> = () => Promise<APIResponse<T>>

// 查询结果类型
export type QueryResult<T> = APIResponse<T>

// 批量查询结果类型
export type BatchQueryResult<T> = Array<QueryResult<T>>

// 本地健康检查配置（避免与全局类型冲突）
export interface LocalHealthCheckConfig {
    enabled: boolean
    interval: number
    timeout: number
    retryAttempts: number
    endpoint?: string
}

// 本地缓存配置增强（避免与全局类型冲突）
export interface LocalEnhancedCacheConfig {
    ttl: number
    maxSize: number
    namespace?: string
    storage?: 'memory' | 'localStorage' | 'redis'
    compression?: boolean
    encryption?: boolean
    keyPrefix?: string
    tags?: string[]
}

// 本地监控配置（避免与全局类型冲突）
export interface LocalMonitoringConfig {
    enabled: boolean
    metricsInterval: number
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    exportMetrics?: boolean
}

// 本地API系统配置（避免与全局类型冲突）
export interface LocalAPISystemConfig extends LocalAPIConfig {
    healthCheck?: LocalHealthCheckConfig
    cache?: LocalEnhancedCacheConfig
    monitoring?: LocalMonitoringConfig
    circuitBreaker?: {
        enabled: boolean
        failureThreshold: number
        resetTimeout: number
    }
}