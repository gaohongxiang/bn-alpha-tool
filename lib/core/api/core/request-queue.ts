import { logger } from "@/lib/core/logger"
import type { LocalAPIConfig, QueueItem } from './types'
import { APIError, TimeoutError, NetworkError } from './types'

export class RequestQueue {
    private queue: QueueItem[] = []
    private processing: boolean = false
    private config: LocalAPIConfig
    private activeRequests: number = 0
    private lastRequestTime: number = 0
    private timeoutHandles: Map<string, NodeJS.Timeout> = new Map()
    private isShuttingDown: boolean = false

    constructor(config: LocalAPIConfig) {
        this.config = config

        // 绑定方法以确保正确的this上下文
        this.process = this.process.bind(this)
        this.handleTimeout = this.handleTimeout.bind(this)
    }

    /**
     * 添加请求到队列
     */
    async add<T>(
        request: () => Promise<T>,
        priority: number = 1,
        timeout: number = this.config.timeout
    ): Promise<T> {
        if (this.isShuttingDown) {
            throw new APIError('Queue is shutting down', 'QUEUE_SHUTDOWN', undefined, false)
        }

        return new Promise<T>((resolve, reject) => {
            const item: QueueItem<T> = {
                id: Math.random().toString(36).substring(7),
                request,
                priority,
                timestamp: Date.now(),
                resolve,
                reject,
                retryCount: 0,
                timeout
            }

            this.queue.push(item)
            this.queue.sort((a, b) => b.priority - a.priority)

            logger.debug('general', `📥 请求已加入队列 (ID: ${item.id}, 优先级: ${priority}, 队列长度: ${this.queue.length})`)

            // 设置超时处理
            if (timeout > 0) {
                const timeoutHandle = setTimeout(() => {
                    this.handleTimeout(item.id)
                }, timeout)
                this.timeoutHandles.set(item.id, timeoutHandle)
            }

            // 异步启动处理，避免阻塞
            setImmediate(() => this.process())
        })
    }

    /**
     * 处理超时
     */
    private handleTimeout(itemId: string): void {
        const index = this.queue.findIndex(i => i.id === itemId)
        if (index !== -1) {
            const item = this.queue.splice(index, 1)[0]
            this.timeoutHandles.delete(itemId)

            logger.debug('general', `⏰ 请求超时 (ID: ${itemId})`)
            item.reject(new TimeoutError('Request timeout in queue', item.timeout))
        }
    }

    /**
     * 处理队列中的请求
     */
    private async process(): Promise<void> {
        if (this.processing || this.queue.length === 0 || this.isShuttingDown) return

        this.processing = true

        try {
            while (this.queue.length > 0 &&
                   this.activeRequests < this.config.rateLimit.burstSize &&
                   !this.isShuttingDown) {

                // 检查速率限制
                const now = Date.now()
                const timeSinceLastRequest = now - this.lastRequestTime
                const minInterval = 1000 / this.config.rateLimit.requestsPerSecond

                if (timeSinceLastRequest < minInterval) {
                    const waitTime = minInterval - timeSinceLastRequest
                    logger.debug('general', `⏱️ 等待速率限制 ${waitTime}ms`)
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                }

                const item = this.queue.shift()
                if (!item) continue

                // 清除超时处理器
                const timeoutHandle = this.timeoutHandles.get(item.id)
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle)
                    this.timeoutHandles.delete(item.id)
                }

                this.activeRequests++
                this.lastRequestTime = Date.now()

                // 异步处理请求，避免阻塞队列
                this.processItem(item).finally(() => {
                    this.activeRequests--
                })
            }
        } catch (error) {
            logger.debug('general', `❌ 队列处理出错: ${error}`)
        } finally {
            this.processing = false

            // 如果队列还有内容且未关闭，继续处理
            if (this.queue.length > 0 && !this.isShuttingDown) {
                setImmediate(() => this.process())
            }
        }
    }

    /**
     * 处理单个请求项
     */
    private async processItem<T>(item: QueueItem<T>): Promise<void> {
        try {
            logger.debug('general', `🔄 处理请求 (ID: ${item.id}, 重试次数: ${item.retryCount}, 活跃请求: ${this.activeRequests})`)

            const result = await item.request()
            item.resolve(result)
            logger.debug('general', `✅ 请求成功 (ID: ${item.id})`)

        } catch (error) {
            logger.debug('general', `❌ 请求失败 (ID: ${item.id}): ${error}`)

            const shouldRetry = this.shouldRetry(error, item)
            if (shouldRetry && !this.isShuttingDown) {
                const delay = this.calculateRetryDelay(item.retryCount)
                item.retryCount++

                logger.debug('general', `⏳ 等待 ${delay}ms 后重试 (ID: ${item.id}, 重试次数: ${item.retryCount})`)

                setTimeout(() => {
                    if (!this.isShuttingDown) {
                        this.queue.unshift(item)
                        this.queue.sort((a, b) => b.priority - a.priority)
                        setImmediate(() => this.process())
                    }
                }, delay)
            } else {
                this.rejectWithProperError(item, error)
            }
        }
    }

    /**
     * 使用适当的错误类型拒绝请求
     */
    private rejectWithProperError<T>(item: QueueItem<T>, error: any): void {
        if (error instanceof APIError) {
            item.reject(error)
        } else if (error instanceof Error) {
            // 根据错误类型创建相应的错误实例
            if (error.message.toLowerCase().includes('timeout')) {
                item.reject(new TimeoutError(error.message, item.timeout))
            } else if (error.message.toLowerCase().includes('network') ||
                       error.name === 'NetworkError' ||
                       (error as any).code === 'ECONNRESET' ||
                       (error as any).code === 'ENOTFOUND') {
                item.reject(new NetworkError(error.message, error))
            } else {
                item.reject(new APIError(error.message, 'REQUEST_ERROR', error))
            }
        } else {
            item.reject(new APIError('Unknown error', 'UNKNOWN_ERROR', error))
        }
    }

    /**
     * 判断是否应该重试请求
     */
    private shouldRetry(error: any, item: QueueItem): boolean {
        // 超过最大重试次数
        if (item.retryCount >= this.config.error.maxRetries) {
            return false
        }

        // 如果是API错误，检查是否可重试
        if (error instanceof APIError) {
            return error.isRetryable
        }

        // 如果配置了重试条件，使用配置的条件
        if (this.config.error.retryCondition) {
            return this.config.error.retryCondition(error)
        }

        // 如果配置了可重试错误列表，检查错误信息
        if (this.config.error.retryableErrors) {
            const errorMessage = error?.message || String(error)
            return this.config.error.retryableErrors.some((e: string) => errorMessage.includes(e))
        }

        // 默认只重试网络错误和速率限制错误
        return error instanceof Error && (
            error.name === 'NetworkError' ||
            error.message?.toLowerCase().includes('network') ||
            error.message?.toLowerCase().includes('timeout') ||
            error.message?.toLowerCase().includes('rate limit')
        )
    }

    /**
     * 计算重试延迟时间
     */
    private calculateRetryDelay(retryCount: number): number {
        const { baseDelay, maxDelay } = this.config.error
        
        // 指数退避策略
        const delay = baseDelay * Math.pow(2, retryCount)
        
        // 添加随机抖动，避免多个请求同时重试
        const jitter = Math.random() * 100
        
        return Math.min(delay + jitter, maxDelay)
    }

    /**
     * 获取队列状态
     */
    getStats() {
        return {
            queueLength: this.queue.length,
            activeRequests: this.activeRequests,
            isProcessing: this.processing,
            lastRequestTime: this.lastRequestTime
        }
    }

    /**
     * 清空队列
     */
    clear(): void {
        // 清除所有超时处理器
        this.timeoutHandles.forEach(handle => clearTimeout(handle))
        this.timeoutHandles.clear()

        // 拒绝所有待处理的请求
        this.queue.forEach(item => {
            item.reject(new APIError('Queue cleared', 'QUEUE_CLEARED', undefined, false))
        })
        this.queue = []
        logger.debug('general', '🗑️ 请求队列已清空')
    }

    /**
     * 优雅关闭队列
     */
    async shutdown(timeout: number = 30000): Promise<void> {
        logger.debug('general', '🔄 开始关闭请求队列...')
        this.isShuttingDown = true

        const startTime = Date.now()

        // 等待所有活跃请求完成
        while (this.activeRequests > 0 && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (this.activeRequests > 0) {
            logger.debug('general', `⚠️ 关闭超时，仍有 ${this.activeRequests} 个活跃请求`)
        }

        // 清空剩余队列
        this.clear()
        logger.debug('general', '✅ 请求队列已关闭')
    }

    /**
     * 获取队列详细状态
     */
    getDetailedStats() {
        const queueByPriority = this.queue.reduce((acc, item) => {
            acc[item.priority] = (acc[item.priority] || 0) + 1
            return acc
        }, {} as Record<number, number>)

        const avgWaitTime = this.queue.length > 0
            ? this.queue.reduce((sum, item) => sum + (Date.now() - item.timestamp), 0) / this.queue.length
            : 0

        return {
            queueLength: this.queue.length,
            activeRequests: this.activeRequests,
            isProcessing: this.processing,
            isShuttingDown: this.isShuttingDown,
            lastRequestTime: this.lastRequestTime,
            queueByPriority,
            averageWaitTime: avgWaitTime,
            timeoutHandles: this.timeoutHandles.size
        }
    }
} 