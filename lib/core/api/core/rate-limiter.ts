import { logger } from "@/lib/core/logger"
import { RateLimitError } from './types'
import type { LocalRateLimitConfig } from './types'

export class TokenBucket {
    private tokens: number
    private lastRefill: number
    private readonly maxTokens: number
    private readonly refillRate: number
    private readonly minTokens: number = 0

    constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = Math.max(1, maxTokens) // 确保至少有1个token
        this.refillRate = Math.max(0.1, refillRate) // 确保有最小填充率
        this.tokens = this.maxTokens
        this.lastRefill = Date.now()
    }

    private refill(): void {
        const now = Date.now()
        const timePassed = (now - this.lastRefill) / 1000

        if (timePassed <= 0) return // 避免时间倒退的情况

        const tokensToAdd = timePassed * this.refillRate

        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
        this.lastRefill = now
    }

    async tryConsume(tokens: number = 1): Promise<boolean> {
        if (tokens <= 0) return true // 无效请求直接通过
        if (tokens > this.maxTokens) return false // 请求超过桶容量

        this.refill()

        if (this.tokens >= tokens) {
            this.tokens -= tokens
            return true
        }

        return false
    }

    getAvailableTokens(): number {
        this.refill()
        return Math.max(this.minTokens, this.tokens)
    }

    getTimeToRefill(requiredTokens: number): number {
        this.refill()
        const deficit = requiredTokens - this.tokens
        if (deficit <= 0) return 0

        return Math.ceil((deficit / this.refillRate) * 1000) // 返回毫秒
    }

    reset(): void {
        this.tokens = this.maxTokens
        this.lastRefill = Date.now()
    }

    getStats() {
        this.refill()
        return {
            available: this.tokens,
            maxTokens: this.maxTokens,
            refillRate: this.refillRate,
            utilizationRate: ((this.maxTokens - this.tokens) / this.maxTokens) * 100
        }
    }
}

export class RateLimiter {
    private buckets: Map<string, TokenBucket> = new Map()
    private readonly config: Required<LocalRateLimitConfig>
    private readonly stats: Map<string, { requests: number, denials: number, lastReset: number }> = new Map()

    constructor(config: Partial<LocalRateLimitConfig> = {}) {
        this.config = {
            requestsPerSecond: Math.max(0.1, config.requestsPerSecond ?? 2),
            burstSize: Math.max(1, config.burstSize ?? 5),
            timeWindow: Math.max(100, config.timeWindow ?? 1000),
            maxTokens: config.maxTokens ?? config.burstSize ?? 5,
            refillRate: config.refillRate ?? config.requestsPerSecond ?? 2
        }

        // 确保配置的一致性
        this.config.maxTokens = Math.max(this.config.maxTokens, this.config.burstSize)
        this.config.refillRate = Math.max(this.config.refillRate, this.config.requestsPerSecond)
    }

    /**
     * 检查是否允许请求
     */
    async isAllowed(resource: string, cost: number = 1): Promise<boolean> {
        if (cost <= 0) return true

        let bucket = this.buckets.get(resource)

        if (!bucket) {
            bucket = new TokenBucket(this.config.maxTokens, this.config.refillRate)
            this.buckets.set(resource, bucket)
            this.initializeStats(resource)
        }

        const allowed = await bucket.tryConsume(cost)
        this.updateStats(resource, allowed)

        return allowed
    }

    /**
     * 初始化资源统计
     */
    private initializeStats(resource: string): void {
        this.stats.set(resource, {
            requests: 0,
            denials: 0,
            lastReset: Date.now()
        })
    }

    /**
     * 更新统计信息
     */
    private updateStats(resource: string, allowed: boolean): void {
        const stat = this.stats.get(resource)
        if (stat) {
            stat.requests++
            if (!allowed) {
                stat.denials++
            }
        }
    }

    /**
     * 执行受速率限制的操作
     */
    async execute<T>(
        resource: string,
        operation: () => Promise<T>,
        cost: number = 1
    ): Promise<T> {
        const isAllowed = await this.isAllowed(resource, cost)

        if (!isAllowed) {
            const bucket = this.buckets.get(resource)
            if (!bucket) {
                throw new RateLimitError(
                    `Rate limiter not initialized for ${resource}`,
                    1000
                )
            }

            const waitTime = bucket.getTimeToRefill(cost)

            logger.debug('general', `🚫 速率限制触发 - 资源: ${resource}, 等待时间: ${waitTime}ms`)

            throw new RateLimitError(
                `Rate limit exceeded for ${resource}. Available tokens: ${bucket.getAvailableTokens()}, Required: ${cost}`,
                waitTime
            )
        }

        try {
            logger.debug('general', `✅ 速率限制通过 - 资源: ${resource}, 消耗: ${cost}`)
            return await operation()
        } catch (error) {
            // 如果操作失败，考虑是否要退还tokens（这里选择不退还，因为请求已经发出）
            logger.debug('general', `❌ 操作执行失败 - 资源: ${resource}, 错误: ${error}`)
            throw error
        }
    }

    /**
     * 等待直到可以执行操作
     */
    async waitAndExecute<T>(
        resource: string,
        operation: () => Promise<T>,
        cost: number = 1,
        maxWaitTime: number = 30000
    ): Promise<T> {
        const startTime = Date.now()

        while (Date.now() - startTime < maxWaitTime) {
            const isAllowed = await this.isAllowed(resource, cost)

            if (isAllowed) {
                return await operation()
            }

            const bucket = this.buckets.get(resource)
            if (bucket) {
                const waitTime = Math.min(bucket.getTimeToRefill(cost), 1000) // 最多等待1秒
                await new Promise(resolve => setTimeout(resolve, waitTime))
            } else {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

        throw new RateLimitError(
            `Rate limit wait timeout for ${resource} after ${maxWaitTime}ms`,
            0
        )
    }

    /**
     * 重置所有速率限制器
     */
    resetAll(): void {
        this.buckets.forEach(bucket => bucket.reset())
        this.stats.forEach(stat => {
            stat.requests = 0
            stat.denials = 0
            stat.lastReset = Date.now()
        })
        logger.debug('general', '已重置所有速率限制器')
    }

    /**
     * 重置特定资源的速率限制器
     */
    reset(resource: string): void {
        const bucket = this.buckets.get(resource)
        if (bucket) {
            bucket.reset()
        }

        const stat = this.stats.get(resource)
        if (stat) {
            stat.requests = 0
            stat.denials = 0
            stat.lastReset = Date.now()
        }

        logger.debug('general', `已重置资源 ${resource} 的速率限制器`)
    }

    /**
     * 获取资源的速率限制状态
     */
    getStatus(resource: string) {
        const bucket = this.buckets.get(resource)
        const stat = this.stats.get(resource)

        return {
            available: bucket?.getAvailableTokens() ?? this.config.maxTokens,
            maxTokens: this.config.maxTokens,
            refillRate: this.config.refillRate,
            stats: bucket?.getStats(),
            requests: stat?.requests ?? 0,
            denials: stat?.denials ?? 0,
            successRate: stat ? ((stat.requests - stat.denials) / stat.requests * 100) : 100,
            lastReset: stat?.lastReset ?? Date.now()
        }
    }

    /**
     * 获取所有资源的状态
     */
    getAllStatus() {
        const status: Record<string, any> = {}

        for (const resource of this.buckets.keys()) {
            status[resource] = this.getStatus(resource)
        }

        return {
            resources: status,
            config: this.config,
            totalResources: this.buckets.size
        }
    }

    /**
     * 清理未使用的资源
     */
    cleanup(maxIdleTime: number = 300000): void { // 5分钟
        const now = Date.now()
        const resourcesToRemove: string[] = []

        this.stats.forEach((stat, resource) => {
            if (now - stat.lastReset > maxIdleTime && stat.requests === 0) {
                resourcesToRemove.push(resource)
            }
        })

        resourcesToRemove.forEach(resource => {
            this.buckets.delete(resource)
            this.stats.delete(resource)
        })

        if (resourcesToRemove.length > 0) {
            logger.debug('general', `清理了 ${resourcesToRemove.length} 个未使用的速率限制器`)
        }
    }
} 