import { apiManager } from './api-manager'
import { debugLog, debugWarn } from '../lib/debug-logger'

interface BlockCache {
  [timestamp: string]: number
}

interface TokenPriceCache {
  [tokenSymbol: string]: {
    [timestamp: string]: number
  }
}

interface DayPriceCache {
  [date: string]: {
    bnbPrice: number
    timestamp: number
  }
}

export class SharedCache {
  private static blockCache: BlockCache = {}
  private static tokenPriceCache: TokenPriceCache = {}
  private static dayPriceCache: DayPriceCache = {}
  
  /**
   * 获取或缓存区块号（避免重复查询同一时间戳）
   */
  static async getBlockNumber(
    timestamp: number, 
    closest: "before" | "after" = "before"
  ): Promise<number> {
    const cacheKey = `${timestamp}_${closest}`
    
    if (this.blockCache[cacheKey]) {
      debugLog(`📦 使用缓存的区块号: ${timestamp} → ${this.blockCache[cacheKey]}`)
      return this.blockCache[cacheKey]
    }
    
    try {
      const response = await apiManager.makeRequest('bsc', 'bscscan', '', {
        module: 'block',
        action: 'getblocknobytime',
        timestamp: timestamp,
        closest: closest
      })

      if (response.success && response.data?.status === '1') {
        const blockNumber = parseInt(response.data.result)
        this.blockCache[cacheKey] = blockNumber
        debugLog(`🔍 查询区块号: ${timestamp} → ${blockNumber} (已缓存)`)
        return blockNumber
      } else {
        throw new Error(`API查询失败: ${response.error}`)
      }
    } catch (error) {
      throw new Error(`Failed to get block number for timestamp ${timestamp}: ${error}`)
    }
  }
  
  /**
   * 获取或缓存代币价格（避免重复查询同一代币的历史价格）
   */
  static async getTokenPrice(
    tokenSymbol: string, 
    timestamp: number, 
    fallbackPrice: number = 0
  ): Promise<number> {
    if (!this.tokenPriceCache[tokenSymbol]) {
      this.tokenPriceCache[tokenSymbol] = {}
    }
    
    const cacheKey = Math.floor(timestamp / 3600).toString() // 按小时缓存
    
    if (this.tokenPriceCache[tokenSymbol][cacheKey]) {
      debugLog(`💰 使用缓存的代币价格: ${tokenSymbol} → $${this.tokenPriceCache[tokenSymbol][cacheKey]}`)
      return this.tokenPriceCache[tokenSymbol][cacheKey]
    }
    
    try {
      // 这里实现代币价格查询逻辑
      // 可以调用CoinGecko API或其他价格服务
      const price = await this.queryTokenPriceFromAPI(tokenSymbol, timestamp)
      
      if (price > 0) {
        this.tokenPriceCache[tokenSymbol][cacheKey] = price
        debugLog(`💲 查询代币价格: ${tokenSymbol} → $${price} (已缓存)`)
        return price
      }
    } catch (error) {
      debugWarn(`⚠️ 代币价格查询失败 ${tokenSymbol}:`, error)
    }
    
    // 使用备用价格
    if (fallbackPrice > 0) {
      this.tokenPriceCache[tokenSymbol][cacheKey] = fallbackPrice
      debugLog(`🔄 使用备用价格: ${tokenSymbol} → $${fallbackPrice}`)
      return fallbackPrice
    }
    
    return 0
  }
  
  /**
   * 获取或缓存当日BNB价格（整天共享）
   */
  static async getDayBnbPrice(date: string): Promise<number> {
    if (this.dayPriceCache[date]) {
      const cached = this.dayPriceCache[date]
      // 缓存1小时内有效
      if (Date.now() - cached.timestamp < 3600000) {
        debugLog(`🏦 使用缓存的BNB价格: ${date} → $${cached.bnbPrice}`)
        return cached.bnbPrice
      }
    }
    
    try {
      // 从CoinGecko获取BNB价格
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd"
      )
      const data = await response.json()
      const bnbPrice = data.binancecoin?.usd || 0
      
      if (bnbPrice > 0) {
        this.dayPriceCache[date] = {
          bnbPrice,
          timestamp: Date.now()
        }
        debugLog(`🌟 查询BNB价格: ${date} → $${bnbPrice} (已缓存)`)
        return bnbPrice
      }
    } catch (error) {
      debugWarn(`⚠️ BNB价格查询失败:`, error)
    }
    
    return 600 // 默认备用价格
  }
  
  /**
   * 实际的代币价格查询API调用
   */
  private static async queryTokenPriceFromAPI(
    tokenSymbol: string, 
    timestamp: number
  ): Promise<number> {
    // 稳定币价格固定为1
    if (["USDT", "USDC", "BUSD", "DAI"].includes(tokenSymbol)) {
      return 1
    }
    
    // BNB价格从CoinGecko获取
    if (tokenSymbol === "BNB") {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd"
        )
        const data = await response.json()
        return data.binancecoin?.usd || 0
      } catch (error) {
        debugWarn("BNB价格查询失败:", error)
        return 0
      }
    }
    
    // 其他代币暂时返回0，后续可以添加更多价格源
    debugLog(`⚠️ 暂不支持 ${tokenSymbol} 的价格查询`)
    return 0
  }
  
  /**
   * 清除所有缓存（调试用）
   */
  static clearCache() {
    this.blockCache = {}
    this.tokenPriceCache = {}
    this.dayPriceCache = {}
    debugLog("🧹 已清除所有共享缓存")
  }
  
  /**
   * 获取缓存统计信息
   */
  static getCacheStats() {
    return {
      blockCacheSize: Object.keys(this.blockCache).length,
      tokenPriceSize: Object.keys(this.tokenPriceCache).length,
      dayPriceSize: Object.keys(this.dayPriceCache).length
    }
  }
} 