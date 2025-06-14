// API管理器类，支持多API Key轮换和健康监测

import { DebugLogger } from '../lib/debug-logger'
import { safeExecute, safeExecuteAsync } from '../lib/error-handler'

interface APIKey {
  key: string
  name: string
  active: boolean
  priority: number
  comment?: string
  isDefault?: boolean    // 是否为默认提供的API Key
  protected?: boolean    // 是否受保护（不能删除）
}

interface NetworkAPI {
  baseUrl: string
  rateLimit: {
    requestsPerSecond: number
    requestsPerDay: number
  }
  keys: APIKey[]
}

interface NetworkConfig {
  name: string
  chainId: number
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
  apis: {
    [apiName: string]: NetworkAPI
  }
  tokens: {
    [symbol: string]: {
      address: string
      symbol: string
      name: string
      decimals: number
    }
  }
}

interface APIHealth {
  keyIndex: number
  lastUsed: number
  errorCount: number
  avgResponseTime: number
  isHealthy: boolean
}

interface APIRequest {
  url: string
  retryCount?: number
  timeoutMs?: number
}

interface APIResponse {
  success: boolean
  data?: any
  error?: string
  responseTime?: number
  keyUsed?: string
}

export class APIManager {
  private networks: { [networkId: string]: NetworkConfig } = {}
  private currentNetwork: string = 'bsc'
  private apiHealth: { [networkId: string]: { [apiName: string]: APIHealth[] } } = {}
  private requestCounters: { [key: string]: number } = {}
  private rotationIndex: { [apiPath: string]: number } = {}
  private configPath: string = '/config/app-config.json'
  
  private initializationComplete: boolean = false
  private initializationPromise: Promise<void>

  constructor() {
    // 使用安全执行包装初始化过程
    this.initializationPromise = safeExecuteAsync(
      () => this.initializeManager(),
      undefined,
      '❌ API管理器初始化失败'
    ).then(() => {
      this.initializationComplete = true
    }).catch((error) => {
      DebugLogger.error('❌ 配置文件加载失败，无法继续:', error)
      this.initializationComplete = true
      throw error
    })
  }

  private async initializeManager(): Promise<void> {
    await this.loadNetworkConfig()
    DebugLogger.log('✅ 网络配置加载完成')
    this.initializeHealthTracking()
  }

  /**
   * 等待API管理器完全初始化
   */
  async waitForInitialization(): Promise<void> {
    if (this.initializationComplete) return
    await this.initializationPromise
  }

  /**
   * 加载网络配置
   */
  private async loadNetworkConfig() {
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
      
      const config = JSON.parse(configData)
      if (config.networks) {
        // 转换配置文件格式以适配api-manager的结构
        this.networks = this.convertConfigFormat(config.networks)
        this.currentNetwork = config.defaultNetwork || 'bsc'
        DebugLogger.log('✅ 从配置文件加载网络配置完成')
        
        // 在浏览器环境中保存到localStorage
        if (typeof window !== 'undefined') {
          this.saveConfigToStorage()
        }
        return
      }
      
      throw new Error('配置文件格式错误，未找到networks配置')
    } catch (error) {
      DebugLogger.error('⚠️ 配置文件加载失败:', error)
      throw error
    }
  }

  /**
   * 转换配置文件格式以适配api-manager的结构
   */
  private convertConfigFormat(networks: any): { [networkId: string]: NetworkConfig } {
    const converted: { [networkId: string]: NetworkConfig } = {}
    
    Object.keys(networks).forEach(networkId => {
      const network = networks[networkId]
      converted[networkId] = {
        name: network.name,
        chainId: network.chainId,
        nativeCurrency: network.nativeCurrency || {
          name: "BNB",
          symbol: "BNB", 
          decimals: 18
        },
        rpcUrls: network.rpcUrls || [],
        blockExplorerUrls: network.blockExplorerUrl ? [network.blockExplorerUrl] : [],
        apis: {
          bscscan: {
            baseUrl: network.api?.baseUrl || "https://api.bscscan.com/api",
            rateLimit: {
              requestsPerSecond: 5,
              requestsPerDay: 100000
            },
            keys: (network.api?.keys || []).map((key: any, index: number) => ({
              ...key,
              priority: index,
              isDefault: true,  // 标记为默认提供的API Key
              protected: true   // 标记为受保护，不能删除
            }))
          }
        },
        tokens: network.tokens || {}
      }
    })
    
    return converted
  }

  /**
   * 保存配置到localStorage（仅在浏览器环境）
   */
  private saveConfigToStorage() {
    if (typeof window === 'undefined') return
    
    safeExecute(() => {
      const config = {
        networks: this.networks,
        settings: {
          defaultNetwork: this.currentNetwork,
          apiStrategy: {
            rotationType: "request",
            failoverEnabled: true,
            healthCheckInterval: 300000,
            retryAttempts: 3
          }
        }
      }
      localStorage.setItem('api-manager-config', JSON.stringify(config))
      DebugLogger.log('✅ 配置已保存到localStorage')
    }, undefined, '❌ 保存配置失败')
  }

  /**
   * 导出配置文件
   */
  exportConfig(): string {
    return safeExecute(() => {
      const config = {
        networks: this.networks,
        settings: {
          defaultNetwork: this.currentNetwork,
          apiStrategy: {
            rotationType: "request",
            failoverEnabled: true,
            healthCheckInterval: 300000,
            retryAttempts: 3
          }
        }
      }
      return JSON.stringify(config, null, 2)
    }, '{}', '❌ 导出配置失败')
  }

  /**
   * 导入配置文件
   */
  importConfig(configJson: string): boolean {
    return safeExecute(() => {
      const config = JSON.parse(configJson)
      if (config.networks) {
        this.networks = config.networks
        this.saveConfigToStorage()
        this.initializeHealthTracking()
        DebugLogger.log('✅ 配置导入成功')
        return true
      }
      return false
    }, false, '❌ 配置导入失败')
  }

  /**
   * 加载用户添加的API Key（仅在浏览器环境）
   */
  private loadUserAPIKeys() {
    if (typeof window === 'undefined') return
    
    safeExecute(() => {
      const userKeys = localStorage.getItem('user-api-keys')
      if (userKeys) {
        const parsedKeys = JSON.parse(userKeys)
        
        Object.keys(parsedKeys).forEach(networkId => {
          if (this.networks[networkId]) {
            Object.keys(parsedKeys[networkId]).forEach(apiName => {
              if (this.networks[networkId].apis[apiName]) {
                const userApiKeys = parsedKeys[networkId][apiName]
                // 添加用户的API Key（确保不重复）
                userApiKeys.forEach((userKey: APIKey) => {
                  if (!this.networks[networkId].apis[apiName].keys.some(k => k.key === userKey.key)) {
                    this.networks[networkId].apis[apiName].keys.push(userKey)
                  }
                })
              }
            })
          }
        })
        
        DebugLogger.log('✅ 用户API Key加载完成')
      }
    }, undefined, '⚠️ 用户API Key加载失败')
  }

  /**
   * 初始化健康状态跟踪
   */
  private initializeHealthTracking() {
    this.apiHealth = {}
    Object.keys(this.networks).forEach(networkId => {
      this.apiHealth[networkId] = {}
      
      Object.keys(this.networks[networkId].apis).forEach(apiName => {
        const api = this.networks[networkId].apis[apiName]
        this.apiHealth[networkId][apiName] = api.keys.map((_, index) => ({
          keyIndex: index,
          lastUsed: 0,
          errorCount: 0,
          avgResponseTime: 0,
          isHealthy: true
        }))
      })
    })
  }

  /**
   * 添加API Key（用户通过界面添加）
   */
  addAPIKey(networkId: string, apiName: string, apiKey: string, name: string): boolean {
    try {
      if (!this.networks[networkId]?.apis[apiName]) {
        return false
      }

      const api = this.networks[networkId].apis[apiName]
      const existingKey = api.keys.find(k => k.key === apiKey)
      
      if (existingKey) {
        DebugLogger.warn('⚠️ API Key已存在')
        return false
      }

      const newPriority = Math.max(...api.keys.map(k => k.priority), 0) + 1
      const newApiKey = {
        key: apiKey,
        name: name,
        active: true,
        priority: newPriority,
        comment: "用户添加的API Key",
        isDefault: false,
        protected: false
      }
      
      api.keys.push(newApiKey)

      // 更新健康状态跟踪
      this.apiHealth[networkId][apiName].push({
        keyIndex: api.keys.length - 1,
        lastUsed: 0,
        errorCount: 0,
        avgResponseTime: 0,
        isHealthy: true
      })

      // 保存用户API Key到单独的存储
      this.saveUserAPIKey(networkId, apiName, newApiKey)

      DebugLogger.log(`✅ 添加用户API Key成功: ${name}`)
      return true
    } catch (error) {
      DebugLogger.error('❌ 添加API Key失败:', error)
      return false
    }
  }

  /**
   * 保存用户API Key到单独存储（仅在浏览器环境）
   */
  private saveUserAPIKey(networkId: string, apiName: string, apiKey: APIKey) {
    if (typeof window === 'undefined') return
    
    safeExecute(() => {
      const userKeys = JSON.parse(localStorage.getItem('user-api-keys') || '{}')
      
      if (!userKeys[networkId]) {
        userKeys[networkId] = {}
      }
      if (!userKeys[networkId][apiName]) {
        userKeys[networkId][apiName] = []
      }
      
      userKeys[networkId][apiName].push(apiKey)
      localStorage.setItem('user-api-keys', JSON.stringify(userKeys))
      
      DebugLogger.log('✅ 用户API Key已保存')
    }, undefined, '❌ 保存用户API Key失败')
  }

  /**
   * 删除API Key（保护默认API Key）
   */
  removeAPIKey(networkId: string, apiName: string, keyIndex: number): boolean {
    try {
      const api = this.networks[networkId]?.apis[apiName]
      if (!api || keyIndex < 0 || keyIndex >= api.keys.length) {
        return false
      }

      const targetKey = api.keys[keyIndex]
      
      // 检查是否为受保护的API Key
      if (targetKey.protected || targetKey.isDefault) {
        DebugLogger.warn('⚠️ 不能删除默认提供的API Key')
        return false
      }

      // 至少保留一个API Key
      if (api.keys.length <= 1) {
        DebugLogger.warn('⚠️ 至少需要保留一个API Key')
        return false
      }

      api.keys.splice(keyIndex, 1)
      this.apiHealth[networkId][apiName].splice(keyIndex, 1)

      // 更新剩余API Key的索引
      this.apiHealth[networkId][apiName].forEach((health, index) => {
        health.keyIndex = index
      })

      this.saveConfigToStorage()
      DebugLogger.log(`✅ 删除用户API Key成功: ${targetKey.name}`)
      return true
    } catch (error) {
      DebugLogger.error('❌ 删除API Key失败:', error)
      return false
    }
  }

  /**
   * 切换API Key状态（保护默认API Key）
   */
  toggleAPIKey(networkId: string, apiName: string, keyIndex: number): boolean {
    try {
      const api = this.networks[networkId]?.apis[apiName]
      if (!api || keyIndex < 0 || keyIndex >= api.keys.length) {
        return false
      }

      const targetKey = api.keys[keyIndex]
      
      // 默认API Key不允许禁用
      if ((targetKey.protected || targetKey.isDefault) && targetKey.active) {
        DebugLogger.warn('⚠️ 不能禁用默认提供的API Key')
        return false
      }

      const activeKeys = api.keys.filter(k => k.active)
      if (activeKeys.length <= 1 && targetKey.active) {
        DebugLogger.warn('⚠️ 至少需要保留一个激活的API Key')
        return false
      }

      targetKey.active = !targetKey.active
      this.saveConfigToStorage()
      
      DebugLogger.log(`✅ API Key状态切换: ${targetKey.name} -> ${targetKey.active ? '激活' : '禁用'}`)
      return true
    } catch (error) {
      DebugLogger.error('❌ 切换API Key状态失败:', error)
      return false
    }
  }

  /**
   * 获取下一个可用的API Key（请求级轮换）
   */
  private getNextAPIKey(networkId: string, apiName: string): { key: string; index: number } | null {
    const api = this.networks[networkId]?.apis[apiName]
    if (!api) return null

    const activeKeys = api.keys.filter(k => k.active && k.key.trim() !== '')
    if (activeKeys.length === 0) return null

    const apiPath = `${networkId}.${apiName}`
    
    // 请求级轮换：每个请求都换下一个API Key
    if (!this.rotationIndex[apiPath]) {
      this.rotationIndex[apiPath] = 0
    }

    // 检查健康状态，跳过不健康的API Key
    let attempts = 0
    while (attempts < activeKeys.length) {
      const currentIndex = this.rotationIndex[apiPath] % activeKeys.length
      const keyIndex = api.keys.findIndex(k => k === activeKeys[currentIndex])
      const health = this.apiHealth[networkId][apiName][keyIndex]

      if (health.isHealthy) {
        this.rotationIndex[apiPath] = (this.rotationIndex[apiPath] + 1) % activeKeys.length
        return {
          key: activeKeys[currentIndex].key,
          index: keyIndex
        }
      }

      // 如果当前API不健康，尝试下一个
      this.rotationIndex[apiPath] = (this.rotationIndex[apiPath] + 1) % activeKeys.length
      attempts++
    }

    // 如果所有API都不健康，返回第一个作为最后的选择
    DebugLogger.warn('⚠️ 所有API Key都不健康，使用第一个作为备用')
    const firstKeyIndex = api.keys.findIndex(k => k === activeKeys[0])
    return {
      key: activeKeys[0].key,
      index: firstKeyIndex
    }
  }

  /**
   * 执行API请求（带自动重试和故障转移）
   */
  async makeRequest(
    networkId: string, 
    apiName: string, 
    endpoint: string, 
    params: { [key: string]: any } = {},
    options: { retryCount?: number; timeoutMs?: number } = {}
  ): Promise<APIResponse> {
    const maxRetries = options.retryCount || 3
    const timeout = options.timeoutMs || 10000
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKeyInfo = this.getNextAPIKey(networkId, apiName)
      
      if (!apiKeyInfo) {
        return {
          success: false,
          error: `没有可用的${apiName} API Key`
        }
      }

      const api = this.networks[networkId].apis[apiName]
      const url = this.buildUrl(api.baseUrl, endpoint, { ...params, apikey: apiKeyInfo.key })
      
      const startTime = Date.now()
      
      try {
        DebugLogger.log(`🔄 API请求 (尝试${attempt + 1}/${maxRetries}): ${apiKeyInfo.key.substring(0, 8)}...`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        
        const response = await fetch(url, {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        const responseTime = Date.now() - startTime
        
        // 更新健康状态
        this.updateAPIHealth(networkId, apiName, apiKeyInfo.index, true, responseTime)
        
        DebugLogger.log(`✅ API请求成功 (${responseTime}ms): ${apiKeyInfo.key.substring(0, 8)}...`)
        
        return {
          success: true,
          data,
          responseTime,
          keyUsed: apiKeyInfo.key.substring(0, 8) + '...'
        }
        
      } catch (error) {
        const responseTime = Date.now() - startTime
        this.updateAPIHealth(networkId, apiName, apiKeyInfo.index, false, responseTime)
        
        DebugLogger.warn(`⚠️ API请求失败 (尝试${attempt + 1}): ${error}`)
        
        // 如果是最后一次尝试，返回错误
        if (attempt === maxRetries - 1) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            responseTime
          }
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
    
    return {
      success: false,
      error: '达到最大重试次数'
    }
  }

  /**
   * 构建请求URL
   */
  private buildUrl(baseUrl: string, endpoint: string, params: { [key: string]: any }): string {
    const url = new URL(baseUrl)
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, String(params[key]))
      }
    })
    return url.toString()
  }

  /**
   * 更新API健康状态
   */
  private updateAPIHealth(
    networkId: string, 
    apiName: string, 
    keyIndex: number, 
    success: boolean, 
    responseTime: number
  ) {
    const health = this.apiHealth[networkId][apiName][keyIndex]
    
    health.lastUsed = Date.now()
    
    if (success) {
      health.errorCount = Math.max(0, health.errorCount - 1) // 成功时减少错误计数
      health.avgResponseTime = (health.avgResponseTime + responseTime) / 2
      health.isHealthy = true
    } else {
      health.errorCount += 1
      health.isHealthy = health.errorCount < 3 // 连续3次错误才标记为不健康
    }
  }

  /**
   * 获取API状态统计
   */
  getAPIStats(): {
    totalKeys: number
    activeKeys: number
    healthyKeys: number
    currentNetwork: string
    requestsPerSecond: number
  } {
    const currentNetworkConfig = this.networks[this.currentNetwork]
    if (!currentNetworkConfig) {
      return {
        totalKeys: 0,
        activeKeys: 0,
        healthyKeys: 0,
        currentNetwork: this.currentNetwork,
        requestsPerSecond: 0
      }
    }

    // 确保健康数据已初始化
    if (!this.apiHealth[this.currentNetwork]) {
      this.initializeHealthTracking()
    }

    let totalKeys = 0
    let activeKeys = 0
    let healthyKeys = 0
    let totalRateLimit = 0

    Object.keys(currentNetworkConfig.apis).forEach(apiName => {
      const api = currentNetworkConfig.apis[apiName]
      const healthData = this.apiHealth[this.currentNetwork]?.[apiName] || []
      
      totalKeys += api.keys.length
      
      // 更精确的活跃API统计
      const activeKeysForThisAPI = api.keys.filter(k => {
        return k.active === true && k.key && k.key.trim().length > 0
      }).length
      
      activeKeys += activeKeysForThisAPI
      healthyKeys += healthData.filter(h => h.isHealthy).length
      
      // 确保rateLimit存在
      if (api.rateLimit && api.rateLimit.requestsPerSecond) {
        totalRateLimit += api.rateLimit.requestsPerSecond * activeKeysForThisAPI
      }
    })

    return {
      totalKeys,
      activeKeys,
      healthyKeys,
      currentNetwork: this.currentNetwork,
      requestsPerSecond: totalRateLimit
    }
  }

  /**
   * 获取当前网络配置
   */
  getCurrentNetworkConfig(): NetworkConfig | null {
    return this.networks[this.currentNetwork] || null
  }

  /**
   * 切换网络
   */
  setCurrentNetwork(networkId: string): boolean {
    if (this.networks[networkId]) {
      this.currentNetwork = networkId
      this.saveConfigToStorage()
      DebugLogger.log(`✅ 切换到网络: ${this.networks[networkId].name}`)
      return true
    }
    DebugLogger.error(`❌ 网络不存在: ${networkId}`)
    return false
  }

  /**
   * 获取所有API Keys
   */
  getAllAPIKeys(networkId?: string): APIKey[] {
    const network = networkId || this.currentNetwork
    const networkConfig = this.networks[network]
    if (!networkConfig) return []

    const allKeys: APIKey[] = []
    Object.values(networkConfig.apis).forEach(api => {
      allKeys.push(...api.keys)
    })
    
    return allKeys
  }
}

// 全局API管理器实例
export const apiManager = new APIManager() 