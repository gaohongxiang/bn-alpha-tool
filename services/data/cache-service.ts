import { DebugLogger } from '../../lib/debug-logger'

interface CacheItem<T> {
  data: T
  timestamp: number
  expiry: number
}

interface CacheConfig {
  defaultTTL: number
  maxSize: number  
  cleanupInterval: number
}

export class CacheService {
  private static instance: CacheService
  private cache = new Map<string, CacheItem<any>>()
  private config: CacheConfig

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000,
      maxSize: 1000,
      cleanupInterval: 60 * 1000,
      ...config
    }
  }

  static getInstance(config?: Partial<CacheConfig>): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(config)
    }
    return CacheService.instance
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item || Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }
    return item.data
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const actualTTL = ttl || this.config.defaultTTL
    const expiry = Date.now() + actualTTL

    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, { data, timestamp: Date.now(), expiry })
  }

  async getOrSet<T>(key: string, getter: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) return cached

    const data = await getter()
    this.set(key, data, ttl)
    return data
  }

  static generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')
    return `${prefix}:${sortedParams}`
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

export const cacheService = CacheService.getInstance() 