import { logger } from "@/lib/core/logger"
import type { LocalEnhancedCacheConfig } from '../core/types'

interface CacheEntry<T> {
    data: T
    timestamp: number
    ttl: number
    accessCount: number
    lastAccessed: number
    tags?: string[]
}

export class MemoryCache {
    private cache: Map<string, CacheEntry<any>> = new Map()
    private config: Required<LocalEnhancedCacheConfig>
    private cleanupInterval: NodeJS.Timeout | null = null

    constructor(config: Partial<LocalEnhancedCacheConfig> = {}) {
        this.config = {
            ttl: config.ttl ?? 300000, // 5分钟默认TTL
            maxSize: config.maxSize ?? 1000,
            namespace: config.namespace ?? 'default',
            storage: config.storage ?? 'memory',
            compression: config.compression ?? false,
            encryption: config.encryption ?? false,
            keyPrefix: config.keyPrefix ?? '',
            tags: config.tags ?? []
        }

        // 启动定期清理
        this.startCleanup()
        logger.debug('general', `[MemoryCache] 初始化完成，命名空间: ${this.config.namespace}`)
    }

    /**
     * 生成缓存键
     */
    private generateKey(key: string): string {
        return `${this.config.keyPrefix}${this.config.namespace}:${key}`
    }

    /**
     * 设置缓存
     */
    set<T>(key: string, data: T, ttl?: number, tags?: string[]): void {
        const cacheKey = this.generateKey(key)
        const now = Date.now()
        
        // 检查缓存大小限制
        if (this.cache.size >= this.config.maxSize && !this.cache.has(cacheKey)) {
            this.evictLRU()
        }

        const entry: CacheEntry<T> = {
            data,
            timestamp: now,
            ttl: ttl ?? this.config.ttl,
            accessCount: 0,
            lastAccessed: now,
            tags: tags || this.config.tags
        }

        this.cache.set(cacheKey, entry)
        logger.debug('general', `📦 缓存设置: ${key} (TTL: ${entry.ttl}ms)`)
    }

    /**
     * 获取缓存
     */
    get<T>(key: string): T | null {
        const cacheKey = this.generateKey(key)
        const entry = this.cache.get(cacheKey)

        if (!entry) {
            logger.debug('general', `❌ 缓存未命中: ${key}`)
            return null
        }

        const now = Date.now()
        
        // 检查是否过期
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(cacheKey)
            logger.debug('general', `⏰ 缓存过期: ${key}`)
            return null
        }

        // 更新访问统计
        entry.accessCount++
        entry.lastAccessed = now

        logger.debug('general', `✅ 缓存命中: ${key} (访问次数: ${entry.accessCount})`)
        return entry.data as T
    }

    /**
     * 检查缓存是否存在且有效
     */
    has(key: string): boolean {
        const cacheKey = this.generateKey(key)
        const entry = this.cache.get(cacheKey)

        if (!entry) return false

        const now = Date.now()
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(cacheKey)
            return false
        }

        return true
    }

    /**
     * 删除缓存
     */
    delete(key: string): boolean {
        const cacheKey = this.generateKey(key)
        const deleted = this.cache.delete(cacheKey)
        
        if (deleted) {
            logger.debug('general', `🗑️ 缓存删除: ${key}`)
        }
        
        return deleted
    }

    /**
     * 根据标签删除缓存
     */
    deleteByTag(tag: string): number {
        let deletedCount = 0
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags && entry.tags.includes(tag)) {
                this.cache.delete(key)
                deletedCount++
            }
        }
        
        if (deletedCount > 0) {
            logger.debug('general', `🏷️ 根据标签删除缓存: ${tag} (${deletedCount}个)`)
        }
        
        return deletedCount
    }

    /**
     * 清空所有缓存
     */
    clear(): void {
        const size = this.cache.size
        this.cache.clear()
        logger.debug('general', `🧹 清空所有缓存 (${size}个)`)
    }

    /**
     * LRU淘汰策略
     */
    private evictLRU(): void {
        let oldestKey: string | null = null
        let oldestTime = Date.now()

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed
                oldestKey = key
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey)
            logger.debug('general', `🔄 LRU淘汰: ${oldestKey}`)
        }
    }

    /**
     * 启动定期清理
     */
    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup()
        }, 60000) // 每分钟清理一次
    }

    /**
     * 清理过期缓存
     */
    private cleanup(): void {
        const now = Date.now()
        let cleanedCount = 0

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key)
                cleanedCount++
            }
        }

        if (cleanedCount > 0) {
            logger.debug('general', `🧹 清理过期缓存: ${cleanedCount}个`)
        }
    }

    /**
     * 获取缓存统计
     */
    getStats() {
        const entries = Array.from(this.cache.values())
        const now = Date.now()
        
        const validEntries = entries.filter(entry => 
            now - entry.timestamp <= entry.ttl
        )

        const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0)
        const avgTTL = entries.length > 0 
            ? entries.reduce((sum, entry) => sum + entry.ttl, 0) / entries.length 
            : 0

        return {
            totalEntries: this.cache.size,
            validEntries: validEntries.length,
            expiredEntries: this.cache.size - validEntries.length,
            totalAccess,
            avgAccessCount: entries.length > 0 ? totalAccess / entries.length : 0,
            avgTTL,
            maxSize: this.config.maxSize,
            utilizationRate: (this.cache.size / this.config.maxSize) * 100,
            namespace: this.config.namespace
        }
    }

    /**
     * 获取所有缓存键
     */
    keys(): string[] {
        return Array.from(this.cache.keys()).map(key => 
            key.replace(`${this.config.keyPrefix}${this.config.namespace}:`, '')
        )
    }

    /**
     * 销毁缓存
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
        
        this.clear()
        logger.debug('general', `💥 缓存已销毁: ${this.config.namespace}`)
    }
}
