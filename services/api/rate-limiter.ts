import { DebugLogger } from '../../lib/debug-logger'

/**
 * 速率限制器
 * 根据可用API Key数量动态调整请求间隔
 */
export class RateLimiter {
  private static instance: RateLimiter
  private queue: Array<() => Promise<any>> = []
  private isProcessing = false
  private requestCount = 0
  private lastRequestTime = 0
  private minInterval: number // 最小请求间隔(ms)
  private activeKeys: number // 活跃的API Key数量

  private constructor() {
    // 默认配置：单个API Key时每1.5秒一个请求
    this.activeKeys = 1
    this.minInterval = 1500
    this.updateRateLimit()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter()
    }
    return RateLimiter.instance
  }

  /**
   * 更新API Key数量并调整速率限制
   */
  setActiveKeys(count: number): void {
    this.activeKeys = Math.max(1, count)
    this.updateRateLimit()
  }

  /**
   * 根据API Key数量动态调整速率限制
   */
  private updateRateLimit(): void {
    // 基础间隔：BSCScan免费版限制每秒5个请求
    // 为了安全，我们设置为每200ms一个请求(每秒5个)
    const baseInterval = 200
    
    // 根据API Key数量调整：更多Key = 更高并发
    // 但要保持每个Key的安全间隔
    this.minInterval = Math.max(baseInterval, Math.floor(1000 / this.activeKeys))
    
    DebugLogger.log('速率限制器初始化', `${this.activeKeys}个API Key，每 ${this.minInterval}ms 一个请求`)
  }

  /**
   * 执行请求（带速率限制）
   */
  async executeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.isProcessing) {
        this.processQueue()
      }
    })
  }

  /**
   * 处理请求队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      
      if (timeSinceLastRequest < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLastRequest
        DebugLogger.log('速率限制', `⏱️ 速率限制等待 ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      const requestFn = this.queue.shift()
      if (requestFn) {
        this.lastRequestTime = Date.now()
        this.requestCount++
        await requestFn()
      }
    }

    this.isProcessing = false
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      queueLength: this.queue.length,
      minInterval: this.minInterval,
      activeKeys: this.activeKeys,
      isProcessing: this.isProcessing
    }
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.requestCount = 0
    this.lastRequestTime = 0
    this.queue = []
    this.isProcessing = false
  }
} 