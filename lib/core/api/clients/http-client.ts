/**
 * HTTP 客户端
 * 集成 API Key 管理、重试、速率限制等基础设施功能
 */

import { logger } from "@/lib/core/logger"
import { APIKeyManager } from '../core/key-manager'
import { RateLimiter } from '../core/rate-limiter'
import { ParallelQueryManager } from '../core/parallel-query'
import type { LocalRateLimitConfig, LocalErrorConfig, SimpleBatchConfig } from '../core/types'

export interface HttpClientConfig {
    apiKeys?: string[]  // 改为可选，不传入时自动从环境变量获取
    rateLimit?: LocalRateLimitConfig
    error?: LocalErrorConfig
    timeout?: number
    baseHeaders?: Record<string, string>
    maxConcurrency?: number
}

export interface HttpRequestOptions extends RequestInit {
    timeout?: number
    retryAttempts?: number
    skipKeyRotation?: boolean
}

export interface HttpBatchRequest {
    url: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    headers?: Record<string, string>
    body?: any
    timeout?: number
}

/**
 * HTTP 客户端
 * 提供单个请求和批量请求的基础设施能力
 */
export class HttpClient {
    private keyManager: APIKeyManager
    private rateLimiter: RateLimiter
    private parallelManager: ParallelQueryManager
    private config: Required<HttpClientConfig>

    constructor(config: HttpClientConfig = {}) {
        // 获取 API Keys：优先使用传入的，否则从环境变量获取
        const apiKeys = config.apiKeys || this.getDefaultApiKeys()

        this.config = {
            apiKeys,
            rateLimit: {
                requestsPerSecond: 10,
                burstSize: 20,
                timeWindow: 1000
            },
            error: {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 10000
            },
            timeout: 30000,
            baseHeaders: {},
            maxConcurrency: 5,
            ...config
        } as Required<HttpClientConfig>

        this.keyManager = new APIKeyManager(this.config.apiKeys)
        this.rateLimiter = new RateLimiter(this.config.rateLimit)
        this.parallelManager = new ParallelQueryManager({
            apiKeys: this.config.apiKeys,
            maxConcurrentRequests: this.config.maxConcurrency,
            queueTimeout: 30000,
            retryStrategy: 'exponential',
            priorityLevels: 3,
            defaultPriority: 1,
            rateLimit: this.config.rateLimit,
            error: this.config.error,
            timeout: this.config.timeout,
            headers: this.config.baseHeaders,
            baseURL: ''
        }, this.config.apiKeys)

        logger.debug('general', `[HttpClient] 初始化完成，使用 ${this.config.apiKeys.length} 个 API Key`)
    }

    /**
     * 从环境变量获取默认的 API Keys
     */
    private getDefaultApiKeys(): string[] {
        const keys: string[] = []

        // 按顺序检查环境变量
        const keyNames = ['MORALIS_API_KEY_1', 'MORALIS_API_KEY_2', 'MORALIS_API_KEY_3']

        keyNames.forEach(keyName => {
            const key = process.env[keyName]?.trim()
            if (key) {
                keys.push(key)
                logger.debug('general', `✅ 找到环境变量: ${keyName}`)
            } else {
                logger.debug('general', `⚠️ 未找到环境变量: ${keyName}`)
            }
        })

        // 兼容旧的环境变量格式（逗号分隔）
        if (keys.length === 0) {
            const legacyKeys = process.env.MORALIS_API_KEY?.split(',').filter(key => key.trim()) || []
            if (legacyKeys.length > 0) {
                keys.push(...legacyKeys)
                logger.debug('general', `✅ 从 MORALIS_API_KEY 获取到 ${legacyKeys.length} 个 Key`)
            }
        }

        if (keys.length === 0) {
            throw new Error(
                '未找到 Moralis API Keys！请设置环境变量：\n' +
                '- MORALIS_API_KEY_1\n' +
                '- MORALIS_API_KEY_2\n' +
                '- MORALIS_API_KEY_3\n' +
                '或者通过 config.apiKeys 参数传入'
            )
        }

        logger.debug('general', `🔑 总共加载了 ${keys.length} 个 Moralis API Key`)
        return keys
    }

    /**
     * 单个 HTTP 请求
     */
    async request(url: string, options: HttpRequestOptions = {}): Promise<Response> {
        const {
            timeout = this.config.timeout,
            retryAttempts = this.config.error.maxRetries,
            skipKeyRotation = false,
            ...fetchOptions
        } = options

        return this.rateLimiter.execute(`http-${url}`, async () => {
            return this.executeWithRetry(url, fetchOptions, {
                timeout,
                retryAttempts,
                skipKeyRotation
            })
        })
    }

    /**
     * 带重试的请求执行
     */
    private async executeWithRetry(
        url: string,
        options: RequestInit,
        config: { timeout: number; retryAttempts: number; skipKeyRotation: boolean }
    ): Promise<Response> {
        let lastError: any
        let currentKey = this.keyManager.getCurrentKey()

        for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
            try {
                const requestOptions: RequestInit = {
                    ...options,
                    headers: {
                        ...this.config.baseHeaders,
                        ...(!config.skipKeyRotation && { 'X-API-Key': currentKey }),
                        ...options.headers
                    },
                    signal: AbortSignal.timeout(config.timeout)
                }

                logger.debug('general', `🌐 HTTP请求: ${options.method || 'GET'} ${url} (尝试 ${attempt + 1}/${config.retryAttempts + 1})`)

                const response = await fetch(url, requestOptions)

                if (response.ok) {
                    if (!config.skipKeyRotation) {
                        this.keyManager.markSuccess(currentKey)
                    }
                    logger.debug('general', `✅ HTTP请求成功: ${response.status}`)
                    return response
                }

                const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
                
                if (!config.skipKeyRotation && this.isAuthError(response.status)) {
                    this.keyManager.markFailure(currentKey, error.message)
                    currentKey = this.keyManager.getCurrentKey()
                    logger.debug('general', `🔄 认证错误，切换到新的 API Key`)
                    continue
                }

                throw error

            } catch (error) {
                lastError = error
                
                if (!config.skipKeyRotation) {
                    this.keyManager.markFailure(currentKey, error instanceof Error ? error.message : String(error))
                }

                if (attempt === config.retryAttempts) {
                    logger.debug('general', `❌ HTTP请求最终失败: ${error}`)
                    throw error
                }

                const delay = Math.min(
                    this.config.error.baseDelay * Math.pow(2, attempt),
                    this.config.error.maxDelay
                )

                logger.debug('general', `⏳ ${delay}ms 后重试...`)
                await new Promise(resolve => setTimeout(resolve, delay))

                if (!config.skipKeyRotation) {
                    currentKey = this.keyManager.getCurrentKey()
                }
            }
        }

        throw lastError
    }

    /**
     * 批量 HTTP 请求
     */
    async batchRequest(
        requests: HttpBatchRequest[],
        config?: SimpleBatchConfig
    ): Promise<Array<{ success: boolean; data?: any; error?: any; index: number; request: HttpBatchRequest }>> {
        if (!requests || requests.length === 0) {
            return []
        }

        logger.debug('general', `🚀 开始批量HTTP请求，共 ${requests.length} 个请求`)

        const requestTasks = requests.map(req => 
            () => this.request(req.url, {
                method: req.method || 'GET',
                headers: req.headers,
                body: req.body ? JSON.stringify(req.body) : undefined,
                timeout: req.timeout
            }).then(response => response.json())
        )

        const results = await this.parallelManager.executeBatch(requestTasks, {
            batchSize: config?.batchSize || 5,
            concurrency: config?.concurrency || 3,
            retryAttempts: config?.retryAttempts || 3,
            progressCallback: config?.progressCallback
        })

        return results.map((result, index) => ({
            ...result,
            request: requests[index]
        }))
    }

    /**
     * 便捷方法：GET 请求
     */
    async get(url: string, options?: HttpRequestOptions): Promise<Response> {
        return this.request(url, { ...options, method: 'GET' })
    }

    /**
     * 便捷方法：POST 请求
     */
    async post(url: string, body?: any, options?: HttpRequestOptions): Promise<Response> {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers
            }
        })
    }

    /**
     * 便捷方法：PUT 请求
     */
    async put(url: string, body?: any, options?: HttpRequestOptions): Promise<Response> {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers
            }
        })
    }

    /**
     * 便捷方法：DELETE 请求
     */
    async delete(url: string, options?: HttpRequestOptions): Promise<Response> {
        return this.request(url, { ...options, method: 'DELETE' })
    }

    /**
     * 判断是否为认证错误
     */
    private isAuthError(status: number): boolean {
        return status === 401 || status === 403
    }

    /**
     * 获取客户端状态
     */
    getStatus() {
        return {
            keyStats: this.keyManager.getStats(),
            rateLimitStats: this.rateLimiter.getAllStatus(),
            parallelStats: this.parallelManager.getStatus(),
            config: {
                timeout: this.config.timeout,
                maxRetries: this.config.error.maxRetries,
                rateLimit: this.config.rateLimit,
                maxConcurrency: this.config.maxConcurrency
            }
        }
    }

    /**
     * 重置客户端状态
     */
    reset() {
        this.keyManager.reset()
        this.rateLimiter.resetAll()
        this.parallelManager.reset()
        logger.debug('general', '🔄 HttpClient 已重置')
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.rateLimiter.cleanup()
        this.parallelManager.cancelAll()
        logger.debug('general', '🧹 HttpClient 资源已清理')
    }
}
