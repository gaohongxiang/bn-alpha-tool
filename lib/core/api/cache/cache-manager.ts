import { logger } from "@/lib/core/logger"
import { MemoryCache } from './memory-cache'
import type { LocalEnhancedCacheConfig } from '../core/types'

export class CacheManager {
    private caches: Map<string, MemoryCache> = new Map()
    private defaultConfig: LocalEnhancedCacheConfig

    constructor(defaultConfig: Partial<LocalEnhancedCacheConfig> = {}) {
        this.defaultConfig = {
            ttl: 300000, // 5分钟
            maxSize: 1000,
            namespace: 'default',
            storage: 'memory',
            compression: false,
            encryption: false,
            keyPrefix: 'api:',
            tags: [],
            ...defaultConfig
        }

        logger.debug('general', '[CacheManager] 初始化完成')
    }

    /**
     * 获取或创建缓存实例
     */
    getCache(namespace: string, config?: Partial<LocalEnhancedCacheConfig>): MemoryCache {
        if (!this.caches.has(namespace)) {
            const cacheConfig = {
                ...this.defaultConfig,
                ...config,
                namespace
            }
            
            const cache = new MemoryCache(cacheConfig)
            this.caches.set(namespace, cache)
            logger.debug('general', `📦 创建新缓存实例: ${namespace}`)
        }

        return this.caches.get(namespace)!
    }

    /**
     * 删除缓存实例
     */
    removeCache(namespace: string): boolean {
        const cache = this.caches.get(namespace)
        if (cache) {
            cache.destroy()
            this.caches.delete(namespace)
            logger.debug('general', `🗑️ 删除缓存实例: ${namespace}`)
            return true
        }
        return false
    }

    /**
     * 获取所有缓存统计
     */
    getAllStats() {
        const stats: Record<string, any> = {}
        
        for (const [namespace, cache] of this.caches.entries()) {
            stats[namespace] = cache.getStats()
        }

        return {
            caches: stats,
            totalCaches: this.caches.size,
            timestamp: Date.now()
        }
    }

    /**
     * 清空所有缓存
     */
    clearAll(): void {
        for (const [namespace, cache] of this.caches.entries()) {
            cache.clear()
        }
        logger.debug('general', '🧹 清空所有缓存实例')
    }

    /**
     * 根据标签清空缓存
     */
    clearByTag(tag: string): number {
        let totalDeleted = 0
        
        for (const [namespace, cache] of this.caches.entries()) {
            totalDeleted += cache.deleteByTag(tag)
        }
        
        logger.debug('general', `🏷️ 根据标签清空缓存: ${tag} (${totalDeleted}个)`)
        return totalDeleted
    }

    /**
     * 销毁所有缓存
     */
    destroy(): void {
        for (const [namespace, cache] of this.caches.entries()) {
            cache.destroy()
        }
        this.caches.clear()
        logger.debug('general', '💥 销毁所有缓存实例')
    }
}

// 创建默认缓存管理器实例（可选使用）
export const defaultCacheManager = new CacheManager({
    ttl: 300000, // 5分钟
    maxSize: 1000
})
