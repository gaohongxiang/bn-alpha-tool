/**
 * 配置管理器
 * 支持按网络组织的配置架构
 */

// ==================== 类型定义 ====================

export interface TokenConfig {
  symbol: string
  name: string
  aliases?: string[]
  isStableCoin?: boolean
  basePrice?: number
  address: string  // 合约地址，native表示原生代币
}

export interface TradingPairConfig {
  from: string
  to: string
  description?: string
}

export interface NetworkConfig {
  name: string
  chainId: number
  rpcUrls: string[]
  blockExplorerUrl: string
  tokens: TokenConfig[]
  pairs: TradingPairConfig[]
  rules: {
    bscVolumeMultiplier: number
    defaultGasPrice: string
    defaultGasLimit: number
  }
  api: {
    baseUrl: string
    keys: Array<{
      key: string
      name: string
      active: boolean
    }>
  }
}

export interface AppConfig {
  networks: {
    [networkId: string]: NetworkConfig
  }
  defaultNetwork: string
}

// ==================== 配置管理器 ====================

class AppConfigManager {
  private static instance: AppConfigManager
  private config: AppConfig | null = null
  private readonly CONFIG_PATH = '/config/app-config.json'
  private readonly STORAGE_KEY = 'bn-alpha-app-config'

  private constructor() {}

  static getInstance(): AppConfigManager {
    if (!AppConfigManager.instance) {
      AppConfigManager.instance = new AppConfigManager()
    }
    return AppConfigManager.instance
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 初始化应用配置...')
      await this.loadConfig()
      console.log('✅ 应用配置初始化完成')
    } catch (error) {
      console.error('❌ 应用配置初始化失败:', error)
      throw error
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      let configData: string;
      
      // 检查是否在浏览器环境
      if (typeof window !== 'undefined') {
        // 浏览器环境，使用fetch
        const response = await fetch('/config/app-config.json')
        if (!response.ok) {
          throw new Error(`配置文件加载失败: ${response.status}`)
        }
        configData = await response.text()
      } else {
        // Node.js环境，直接读取public目录下的配置文件
        const fs = await import('fs/promises')
        const path = await import('path')
        const configPath = path.join(process.cwd(), 'public', 'config', 'app-config.json')
        configData = await fs.readFile(configPath, 'utf-8')
      }
      
      const config = JSON.parse(configData) as AppConfig
      this.config = config
      
      // 合并用户自定义API Keys
      this.mergeUserAPIKeys()
      
      console.log(`📋 配置加载成功`)
    } catch (error) {
      console.error('配置文件加载失败:', error)
      throw error
    }
  }

  private mergeUserAPIKeys(): void {
    try {
      if (typeof window !== 'undefined') {
        const userKeys = localStorage.getItem(this.STORAGE_KEY)
        if (userKeys) {
          const parsed = JSON.parse(userKeys)
          // 按网络合并用户API Keys
          Object.keys(parsed).forEach(networkId => {
            if (this.config!.networks[networkId] && Array.isArray(parsed[networkId])) {
              parsed[networkId].forEach((userKey: any) => {
                const exists = this.config!.networks[networkId].api.keys.some(k => k.key === userKey.key)
                if (!exists) {
                  this.config!.networks[networkId].api.keys.push(userKey)
                }
              })
            }
          })
        }
      }
    } catch (error) {
      console.warn('用户API Keys合并失败:', error)
    }
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('配置未初始化，请先调用 initialize()')
    }
    return JSON.parse(JSON.stringify(this.config))
  }

  // ==================== 网络相关 ====================

  /**
   * 获取当前网络ID
   */
  getCurrentNetwork(): string {
    return this.config?.defaultNetwork || 'bsc'
  }

  /**
   * 获取当前网络配置
   */
  getCurrentNetworkConfig(): NetworkConfig | null {
    const networkId = this.getCurrentNetwork()
    return this.config?.networks[networkId] || null
  }

  /**
   * 获取所有网络
   */
  getNetworks(): { [networkId: string]: NetworkConfig } {
    return this.config?.networks || {}
  }

  // ==================== 交易配置相关 ====================

  getTokens(): TokenConfig[] {
    const network = this.getCurrentNetworkConfig()
    return network?.tokens || []
  }

  getTradingPairs(): TradingPairConfig[] {
    const network = this.getCurrentNetworkConfig()
    return network?.pairs || []
  }

  /**
   * 检查是否为有效交易对
   */
  isValidTradingPair(from: string, to: string): boolean {
    const normalizedFrom = this.normalizeTokenSymbol(from)
    const normalizedTo = this.normalizeTokenSymbol(to)
    
    return this.getTradingPairs().some(pair => 
      pair.from === normalizedFrom && pair.to === normalizedTo
    )
  }

  /**
   * 检查是否应计入交易量
   * 规则：卖出换稳定币的不计算交易量（即to为稳定币的不计算）
   */
  shouldCountForVolume(from: string, to: string): boolean {
    const normalizedFrom = this.normalizeTokenSymbol(from)
    const normalizedTo = this.normalizeTokenSymbol(to)
    
    // 如果不是有效交易对，不计算
    if (!this.isValidTradingPair(normalizedFrom, normalizedTo)) {
      return false
    }

    // 如果to是稳定币，不计算交易量（卖出换稳定币）
    const stableCoins = this.getStableCoins()
    if (stableCoins.includes(normalizedTo)) {
      return false
    }

    return true
  }

  /**
   * 检查是否为支持的代币
   */
  isSupportedToken(symbol: string): boolean {
    const normalized = this.normalizeTokenSymbol(symbol)
    return this.getTokens().some(token => token.symbol === normalized)
  }

  /**
   * 标准化代币符号（处理别名映射）
   */
  normalizeTokenSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase()
    
    // 查找别名映射
    for (const token of this.getTokens()) {
      if (token.symbol === upperSymbol) {
        return token.symbol
      }
      if (token.aliases?.includes(upperSymbol)) {
        return token.symbol
      }
    }
    
    return upperSymbol
  }

  /**
   * 获取代币信息
   */
  getTokenInfo(symbol: string): TokenConfig | null {
    const normalized = this.normalizeTokenSymbol(symbol)
    return this.getTokens().find(token => token.symbol === normalized) || null
  }

  /**
   * 获取代币合约地址
   */
  getTokenAddress(symbol: string): string | null {
    const tokenInfo = this.getTokenInfo(symbol)
    return tokenInfo?.address || null
  }

  /**
   * 获取稳定币列表
   */
  getStableCoins(): string[] {
    return this.getTokens()
      .filter(token => token.isStableCoin)
      .map(token => token.symbol)
  }

  getTradingRules() {
    const network = this.getCurrentNetworkConfig()
    return network?.rules || null
  }

  // ==================== API配置相关 ====================

  getAPIConfig() {
    const network = this.getCurrentNetworkConfig()
    return network?.api || null
  }

  getActiveAPIKeys() {
    const apiConfig = this.getAPIConfig()
    return apiConfig?.keys.filter(key => key.active) || []
  }

  addUserAPIKey(keyConfig: any): boolean {
    try {
      const networkId = this.getCurrentNetwork()
      const userKeys = this.getUserAPIKeys()
      
      if (!userKeys[networkId]) {
        userKeys[networkId] = []
      }
      
      userKeys[networkId].push({
        ...keyConfig,
        active: true
      })
      
      this.saveUserAPIKeys(userKeys)
      this.mergeUserAPIKeys()
      return true
    } catch (error) {
      console.error('添加API密钥失败:', error)
      return false
    }
  }

  private getUserAPIKeys(): any {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(this.STORAGE_KEY)
        return saved ? JSON.parse(saved) : {}
      }
    } catch (error) {
      console.warn('读取用户API Keys失败:', error)
    }
    return {}
  }

  private saveUserAPIKeys(userKeys: any): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userKeys))
      }
    } catch (error) {
      console.error('保存用户API Keys失败:', error)
    }
  }



  /**
   * 获取配置统计信息
   */
  getStats() {
    if (!this.config) return null

    const network = this.getCurrentNetworkConfig()
    if (!network) return null

    const pairs = network.pairs
    const volumeCountingPairs = pairs.filter(p => 
      this.shouldCountForVolume(p.from, p.to)
    )
    
    return {
      currentNetwork: this.getCurrentNetwork(),
      totalTokens: network.tokens.length,
      totalPairs: pairs.length,
      volumeCountingPairs: volumeCountingPairs.length,
      totalAPIKeys: network.api.keys.length
    }
  }
}

// 导出单例实例
export const configManager = AppConfigManager.getInstance()

// 兼容性导出（保持向后兼容）
export class TradingConfigManager {
  static getConfig() {
    return {
      tokens: configManager.getTokens(),
      pairs: configManager.getTradingPairs(),
      rules: configManager.getTradingRules()
    }
  }

  static isValidTradingPair(from: string, to: string): boolean {
    return configManager.isValidTradingPair(from, to)
  }

  static shouldCountForVolume(from: string, to: string): boolean {
    return configManager.shouldCountForVolume(from, to)
  }

  static isSupportedToken(symbol: string): boolean {
    return configManager.isSupportedToken(symbol)
  }

  static getMappedTokenSymbol(symbol: string): string {
    return configManager.normalizeTokenSymbol(symbol)
  }

  static getStats() {
    return configManager.getStats()
  }
}

export default configManager 