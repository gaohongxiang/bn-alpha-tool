import type { APIResponse, APIKey, BSCScanResponse, BSCScanTransaction } from '@/types'
import { APIClient } from './api-client'
import { RateLimiter } from './rate-limiter'
import { DebugLogger } from '../../lib/debug-logger'
import { configManager } from '../../lib/config-manager'

/**
 * BSCScan API服务
 * 专门处理BSCScan API的调用和管理
 */
export class BSCScanService {
  private static instance: BSCScanService
  private client: APIClient
  private rateLimiter: RateLimiter
  private apiKeys: APIKey[] = []
  private currentKeyIndex: number = 0

  private constructor() {
    this.client = new APIClient('https://api.bscscan.com/api')
    this.rateLimiter = RateLimiter.getInstance() // 动态速率限制
    // 不在构造函数中异步初始化，避免竞态问题
  }

  /**
   * 获取单例实例
   */
  static getInstance(): BSCScanService {
    if (!BSCScanService.instance) {
      BSCScanService.instance = new BSCScanService()
    }
    return BSCScanService.instance
  }

  /**
   * 从配置初始化API Keys
   */
  private async initializeAPIKeysFromConfig(): Promise<void> {
    try {
      await configManager.initialize()
      const config = configManager.getAPIConfig()
      if (config?.keys) {
        // 转换配置中的API key格式为统一的APIKey类型
        this.apiKeys = config.keys
          .filter(key => key.active)
          .map((key, index) => ({
            key: key.key,
            name: key.name,
            active: key.active,
            priority: index,
            isDefault: true,
            protected: true
          }))
        DebugLogger.log(`🔑 BSCScan API Keys初始化: ${this.apiKeys.length}个可用`)
        
        // 通知速率限制器可用的API Key数量
        if (this.apiKeys.length > 0) {
          this.rateLimiter.setActiveKeys(this.apiKeys.length)
        }
      }
    } catch (error) {
      DebugLogger.error('❌ BSCScan API Keys初始化失败:', error)
    }
  }

  /**
   * 确保API Keys已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.apiKeys.length === 0) {
      DebugLogger.log('BSCScan初始化', '检测到API Keys未初始化，开始初始化...')
      await this.initializeAPIKeysFromConfig()
    }
  }

  /**
   * 获取下一个可用的API Key
   */
  private getNextAPIKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error('没有可用的BSCScan API Key')
    }

    // 轮换API Key
    const apiKey = this.apiKeys[this.currentKeyIndex]
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length

    return apiKey.key
  }

  /**
   * 执行BSCScan API请求（带速率限制）
   * @param params 请求参数
   * @returns API响应
   */
  async makeRequest<T = any>(params: Record<string, any>): Promise<APIResponse<BSCScanResponse<T>>> {
    await this.ensureInitialized()
    return this.rateLimiter.executeRequest(async () => {
      const apiKey = this.getNextAPIKey()
      const fullParams = {
        ...params,
        apikey: apiKey
      }

      DebugLogger.log(`🔄 BSCScan请求: ${params.module}/${params.action}`)
      
      const response = await this.client.get<BSCScanResponse<T>>('', fullParams, {
        apiKey: apiKey.substring(0, 8) + '...'
      })

      // 检查BSCScan特有的响应格式
      if (response.success && response.data) {
        if (response.data.status === "0" && response.data.message === "NOTOK") {
          // BSCScan返回错误
          return {
            ...response,
            success: false,
            error: `BSCScan API错误: ${response.data.result || response.data.message}`
          }
        }
      }

      return response
    })
  }

  /**
   * 获取钱包余额
   * @param address 钱包地址
   * @param tag 区块标签 ('latest', 'earliest', 'pending' 或区块号)
   * @returns 余额响应
   */
  async getBalance(address: string, tag: string = 'latest'): Promise<APIResponse<BSCScanResponse<string>>> {
    return this.makeRequest({
      module: 'account',
      action: 'balance',
      address: address,
      tag: tag
    })
  }

  /**
   * 获取代币余额
   * @param contractAddress 合约地址
   * @param address 钱包地址
   * @param tag 区块标签
   * @returns 代币余额响应
   */
  async getTokenBalance(
    contractAddress: string, 
    address: string, 
    tag: string = 'latest'
  ): Promise<APIResponse<BSCScanResponse<string>>> {
    return this.makeRequest({
      module: 'account',
      action: 'tokenbalance',
      contractaddress: contractAddress,
      address: address,
      tag: tag
    })
  }

  /**
   * 获取代币交易列表
   * @param contractAddress 合约地址
   * @param address 钱包地址
   * @param startBlock 开始区块
   * @param endBlock 结束区块
   * @param page 页码
   * @param offset 每页数量
   * @returns 代币交易列表
   */
  async getTokenTransactions(
    contractAddress: string,
    address: string,
    startBlock?: number,
    endBlock?: number,
    page: number = 1,
    offset: number = 10000
  ): Promise<APIResponse<BSCScanResponse<BSCScanTransaction[]>>> {
    const params: Record<string, any> = {
      module: 'account',
      action: 'tokentx',
      contractaddress: contractAddress,
      address: address,
      page: page,
      offset: offset,
      sort: 'asc'
    }

    if (startBlock !== undefined) {
      params.startblock = startBlock
    }
    if (endBlock !== undefined) {
      params.endblock = endBlock
    }

    return this.makeRequest(params)
  }

  /**
   * 获取普通交易列表
   * @param address 钱包地址
   * @param startBlock 开始区块
   * @param endBlock 结束区块
   * @param page 页码
   * @param offset 每页数量
   * @returns 普通交易列表
   */
  async getTransactions(
    address: string,
    startBlock?: number,
    endBlock?: number,
    page: number = 1,
    offset: number = 10000
  ): Promise<APIResponse<BSCScanResponse<BSCScanTransaction[]>>> {
    const params: Record<string, any> = {
      module: 'account',
      action: 'txlist',
      address: address,
      page: page,
      offset: offset,
      sort: 'asc'
    }

    if (startBlock !== undefined) {
      params.startblock = startBlock
    }
    if (endBlock !== undefined) {
      params.endblock = endBlock
    }

    return this.makeRequest(params)
  }

  /**
   * 根据时间戳获取区块号
   * @param timestamp 时间戳
   * @param closest 'before' 或 'after'
   * @returns 区块号
   */
  async getBlockByTimestamp(
    timestamp: number, 
    closest: 'before' | 'after' = 'before'
  ): Promise<APIResponse<BSCScanResponse<string>>> {
    return this.makeRequest({
      module: 'block',
      action: 'getblocknobytime',
      timestamp: timestamp,
      closest: closest
    })
  }

  /**
   * 获取最新区块号
   * @returns 最新区块号
   */
  async getLatestBlockNumber(): Promise<APIResponse<BSCScanResponse<string>>> {
    return this.makeRequest({
      module: 'proxy',
      action: 'eth_blockNumber'
    })
  }

  /**
   * 获取BNB价格
   * @returns BNB价格
   */
  async getBNBPrice(): Promise<APIResponse<BSCScanResponse<{ ethusd: string }>>> {
    return this.makeRequest({
      module: 'stats',
      action: 'bnbprice'
    })
  }

  /**
   * 获取API使用统计
   */
  getAPIStats(): {
    totalKeys: number
    activeKeys: number
    currentKeyIndex: number
    rateLimiterStatus: any
  } {
    return {
      totalKeys: this.apiKeys.length,
      activeKeys: this.apiKeys.filter(key => key.active).length,
      currentKeyIndex: this.currentKeyIndex,
      rateLimiterStatus: this.rateLimiter.getStats()
    }
  }

  /**
   * 重新加载API Keys
   */
  async reloadAPIKeys(): Promise<void> {
    await this.initializeAPIKeysFromConfig()
  }

  /**
   * 手动设置API Keys
   * @param apiKeys API Key配置数组
   */
  setAPIKeys(apiKeys: { key: string; active: boolean }[]): void {
    // 转换为APIKey类型
    this.apiKeys = apiKeys
      .filter(key => key.active)
      .map((key, index) => ({
        key: key.key,
        name: `key-${index + 1}`,
        active: key.active,
        priority: index,
        isDefault: true,
        protected: true
      }))
    
    this.currentKeyIndex = 0
    
    DebugLogger.log('BSCScan初始化', `🔑 BSCScan API Keys手动设置: ${this.apiKeys.length}个可用`)
    
    // 通知速率限制器可用的API Key数量
    if (this.apiKeys.length > 0) {
      this.rateLimiter.setActiveKeys(this.apiKeys.length)
    }
    
    if (this.apiKeys.length === 0) {
      DebugLogger.log('BSCScan警告', '⚠️ 没有可用的BSCScan API Key，所有请求将失败')
    }
  }
} 