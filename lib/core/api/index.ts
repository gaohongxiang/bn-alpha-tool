/**
 * lib/api - 基础设施层 API 系统
 *
 * 职责：
 * - 多 API Key 管理和轮换
 * - 并发控制和批量处理
 * - 速率限制管理
 * - HTTP 请求客户端
 * - 通用缓存机制
 * - 重试和错误处理
 */

// ===== 主要客户端接口 =====
import {
    HttpClient as HttpClientClass,
    type HttpClientConfig,
    type HttpRequestOptions,
    type HttpBatchRequest
} from './clients/http-client'

export { HttpClientClass as HttpClient }
export type {
    HttpClientConfig,
    HttpRequestOptions,
    HttpBatchRequest
}

// ===== 核心基础设施组件 =====
export { APIKeyManager } from './core/key-manager'
export { ParallelQueryManager } from './core/parallel-query'
export { RateLimiter, TokenBucket } from './core/rate-limiter'
export { RequestQueue } from './core/request-queue'

// ===== 缓存系统 =====
export { MemoryCache } from './cache/memory-cache'
export { CacheManager, defaultCacheManager } from './cache/cache-manager'

// ===== 类型定义 =====
export type {
    // 核心配置类型
    ParallelQueryConfig,
    LocalRateLimitConfig,
    LocalErrorConfig,
    SimpleBatchConfig,
    RequestFunction,

    // API 相关类型
    APIResponse,
    APIKeyStats,
    APIKeyInfo,

    // 缓存相关类型
    LocalEnhancedCacheConfig
} from './core/types'

// ===== 错误类型 =====
export {
    APIError,
    RateLimitError,
    APIKeyError,
    TimeoutError,
    NetworkError
} from './core/types'

// ===== 便捷工厂函数 =====

/**
 * 创建 HTTP 客户端
 * @param config 配置选项，apiKeys 可选（不传入时自动从环境变量获取）
 */
export function createHttpClient(config?: HttpClientConfig): HttpClientClass {
    return new HttpClientClass(config)
}