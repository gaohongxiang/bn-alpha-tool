import { logger } from '@/lib/core/logger'
import { APIKeyManager } from './key-manager'
import { RequestQueue } from './request-queue'
import { RateLimiter } from './rate-limiter'
import type { ParallelQueryConfig, RequestFunction, SimpleBatchConfig } from './types'

/**
 * 简化的并行查询管理器
 * 专注于HTTP和Moralis请求的批量处理
 */
export class ParallelQueryManager {
    private config: ParallelQueryConfig
    private requestQueue: RequestQueue
    private rateLimiter: RateLimiter
    private keyManager?: APIKeyManager
    private isShuttingDown: boolean = false

    constructor(config: ParallelQueryConfig, apiKeys?: string[]) {
        this.config = config
        this.requestQueue = new RequestQueue(config)
        this.rateLimiter = new RateLimiter(config.rateLimit)

        if (apiKeys && apiKeys.length > 0) {
            this.keyManager = new APIKeyManager(apiKeys)
        }

        logger.debug('parallel-query', `[ParallelQueryManager] 初始化完成`)
    }

    /**
     * 执行批量请求 - 简化版本
     */
    async executeBatch<T>(
        requests: RequestFunction<T>[],
        config?: SimpleBatchConfig
    ): Promise<Array<{ success: boolean; data?: T; error?: string; index: number }>> {
        if (this.isShuttingDown) {
            throw new Error('ParallelQueryManager is shutting down')
        }

        const batchConfig = {
            batchSize: Math.min(requests.length, this.config.maxConcurrentRequests || 5),
            concurrency: this.config.maxConcurrentRequests || 5,
            retryAttempts: 3,
            ...config
        }

        const results: Array<{ success: boolean; data?: T; error?: string; index: number }> = []
        const batches = this.createBatches(requests, batchConfig.batchSize)
        let completedRequests = 0

        logger.debug('parallel-query', `🚀 开始批量处理，共 ${requests.length} 个请求，分 ${batches.length} 批执行`)
        logger.debug('parallel-query', `⚙️ 批量配置: batchSize=${batchConfig.batchSize}, concurrency=${batchConfig.concurrency}, retryAttempts=${batchConfig.retryAttempts}`)

        try {
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                if (this.isShuttingDown) break

                const batch = batches[batchIndex]
                logger.debug('parallel-query', `📦 处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个请求`)

                const batchPromises = batch.map(async (request, itemIndex) => {
                    const globalIndex = batchIndex * batchConfig.batchSize + itemIndex
                    logger.debug('parallel-query', `🔄 启动请求 ${globalIndex + 1}/${requests.length} (批次 ${batchIndex + 1}, 项目 ${itemIndex + 1})`)

                    try {
                        const requestStartTime = Date.now()
                        const result = await this.executeWithRetry(request, batchConfig)
                        const requestTime = Date.now() - requestStartTime
                        completedRequests++

                        logger.debug('parallel-query', `✅ 请求 ${globalIndex + 1} 完成，耗时 ${requestTime}ms`)

                        // 进度回调
                        if (batchConfig.progressCallback) {
                            const progress = (completedRequests / requests.length) * 100
                            logger.debug('parallel-query', `📊 进度更新: ${progress.toFixed(1)}% (${completedRequests}/${requests.length})`)
                            batchConfig.progressCallback(progress, completedRequests, requests.length)
                        }

                        return { success: true, data: result, index: globalIndex }

                    } catch (error) {
                        completedRequests++
                        logger.debug('parallel-query', `❌ 请求 ${globalIndex + 1} 失败: ${error}`)
                        return {
                            success: false,
                            error: error instanceof Error ? error.message : String(error),
                            index: globalIndex
                        }
                    }
                })

                logger.debug('parallel-query', `⏳ 等待第 ${batchIndex + 1} 批的 ${batch.length} 个并发请求完成...`)

                const batchResults = await Promise.allSettled(batchPromises)
                logger.debug('parallel-query', `📋 第 ${batchIndex + 1} 批完成，处理 ${batchResults.length} 个结果`)

                // 处理批次结果
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push(result.value)
                        logger.debug('parallel-query', `✅ 批次结果 ${index + 1}: 成功`)
                    } else {
                        results.push({
                            success: false,
                            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
                            index: -1
                        })
                        logger.debug('parallel-query', `❌ 批次结果 ${index + 1}: 失败 - ${result.reason}`)
                    }
                })

                // 批次间延迟（仅在大批量处理时使用）
                if (batchIndex < batches.length - 1 && !this.isShuttingDown && requests.length > 20) {
                    await new Promise(resolve => setTimeout(resolve, 50)) // 减少延迟时间
                }
            }
        } catch (error) {
            logger.debug('parallel-query', `❌ 批量处理过程中发生错误: ${error}`)
            throw error
        }

        logger.debug('parallel-query', `✅ 批量处理完成，处理了 ${results.length} 个请求`)
        return results
    }

    /**
     * 执行单个请求（带重试）
     */
    private async executeWithRetry<T>(
        request: RequestFunction<T>,
        config: SimpleBatchConfig
    ): Promise<T> {
        let lastError: Error | null = null

        for (let attempt = 0; attempt < (config.retryAttempts || 3); attempt++) {
            try {
                logger.debug('parallel-query', `🔄 执行请求 (尝试 ${attempt + 1}/${config.retryAttempts || 3})`)

                // 如果有API Key管理器，标记使用
                const apiKey = this.keyManager?.getCurrentKey()
                if (apiKey) {
                    logger.debug('parallel-query', `🔑 使用 API Key: ${apiKey.substring(0, 10)}...`)
                }

                const result = await this.requestQueue.add(
                    request,
                    1, // 默认优先级
                    this.config.queueTimeout
                )

                // 标记成功
                if (this.keyManager && apiKey) {
                    this.keyManager.markSuccess(apiKey)
                }

                logger.debug('parallel-query', `✅ 请求执行成功 (尝试 ${attempt + 1})`)
                return result

            } catch (error) {
                lastError = error as Error

                logger.debug('parallel-query', `❌ 请求失败 (尝试 ${attempt + 1}/${config.retryAttempts}): ${error}`)

                // 如果是API Key相关错误，标记失败
                if (this.keyManager && this.isApiKeyError(error)) {
                    const apiKey = this.keyManager.getCurrentKey()
                    this.keyManager.markFailure(apiKey, error?.toString())
                    logger.debug('parallel-query', `🔑 API Key 标记为失败: ${apiKey?.substring(0, 10)}...`)
                }

                // 如果不是最后一次尝试，等待后重试（优化延迟时间）
                if (attempt < (config.retryAttempts || 3) - 1) {
                    const baseDelay = Math.min(Math.pow(2, attempt) * 200, 2000) // 减少基础延迟，最大2秒
                    const jitter = Math.random() * 200 // 减少随机延迟
                    const delay = baseDelay + jitter
                    logger.debug('parallel-query', `⏳ 重试延迟 ${delay.toFixed(0)}ms 后重试...`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
        }

        throw lastError || new Error(`请求失败，已达到最大重试次数`)
    }

    /**
     * 判断是否是API密钥相关的错误
     */
    private isApiKeyError(error: any): boolean {
        if (!error) return false

        const errorMsg = error?.toString().toLowerCase()
        return errorMsg.includes('api key') ||
               errorMsg.includes('unauthorized') ||
               errorMsg.includes('rate limit') ||
               errorMsg.includes('forbidden') ||
               errorMsg.includes('authentication')
    }

    /**
     * 创建查询批次
     */
    private createBatches<U>(queries: U[], batchSize: number): U[][] {
        const batches: U[][] = []
        for (let i = 0; i < queries.length; i += batchSize) {
            batches.push(queries.slice(i, i + batchSize))
        }
        return batches
    }

    /**
     * 获取管理器状态
     */
    getStatus() {
        return {
            queue: this.requestQueue.getDetailedStats(),
            rateLimit: this.rateLimiter.getAllStatus(),
            keys: this.keyManager?.getStats(),
            isShuttingDown: this.isShuttingDown
        }
    }

    /**
     * 获取管理器统计信息 (getStats 别名)
     */
    getStats() {
        return this.getStatus()
    }

    /**
     * 重置管理器状态
     */
    reset(): void {
        this.keyManager?.reset()
        this.requestQueue.clear()
        this.rateLimiter.resetAll()
        this.isShuttingDown = false
        logger.debug('parallel-query', '🔄 并行查询管理器已重置')
    }

    /**
     * 优雅关闭管理器
     */
    async shutdown(timeout: number = 30000): Promise<void> {
        logger.debug('parallel-query', '🔄 开始关闭并行查询管理器...')
        this.isShuttingDown = true

        await this.requestQueue.shutdown(timeout)
        logger.debug('parallel-query', '✅ 并行查询管理器已关闭')
    }

    /**
     * 取消所有请求
     */
    cancelAll(): void {
        this.requestQueue.clear()
        logger.debug('parallel-query', '🗑️ 已取消所有请求')
    }
} 