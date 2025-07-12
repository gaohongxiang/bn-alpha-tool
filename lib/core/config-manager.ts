/**
 * 统一配置管理器
 * 负责加载、验证和提供所有应用配置
 */

import { logger } from './logger'

// 配置类型定义
export interface APIConfig {
  http: {
    rateLimit: {
      requestsPerSecond: number
      burstSize: number
      timeWindow: number
    }
    concurrency: {
      maxConcurrentRequests: number
      queueTimeout: number
    }
    retry: {
      maxRetries: number
      baseDelay: number
      maxDelay: number
    }
    timeout: {
      default: number
    }
    headers: Record<string, string>
  }
  batch: {
    defaultBatchSize: number
    maxBatchSize: number
    batchTimeout: number
  }
  cache: {
    defaultTTL: number
    maxSize: number
    cleanupInterval: number
  }
}

// 动态配置类型（继承自APIConfig但可以有运行时调整的值）
export type DynamicAPIConfig = APIConfig

// 移除了 AppConfig 接口，当前应用不需要复杂的应用配置

export interface EnvConfig {
  moralisApiKeys: string[]  // 保留用于 HTTP 客户端的 API keys
  nodeEnv: string
  logLevel: string
  cacheTTL: number
  apiTimeout: number
  enableDebugMode: boolean
  enableExperimentalFeatures: boolean
  enableVerboseLogging: boolean
}

/**
 * 统一配置管理器
 */
class ConfigManager {
  private static instance: ConfigManager
  private apiConfig: APIConfig | null = null
  private envConfig: EnvConfig | null = null

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  /**
   * 获取环境变量配置
   */
  getEnvConfig(): EnvConfig {
    if (!this.envConfig) {
      this.envConfig = this.loadEnvConfig()
    }
    return this.envConfig
  }

  /**
   * 获取 API 配置
   */
  getAPIConfig(): APIConfig {
    if (!this.apiConfig) {
      this.apiConfig = this.loadAPIConfig()
    }
    return this.apiConfig
  }

  // 移除了 getAppConfig 方法



  /**
   * 获取 HTTP 配置
   */
  getHttpConfig() {
    return this.getAPIConfig().http
  }

  // 移除了 getFeatureConfig 方法

  /**
   * 加载环境变量配置
   */
  private loadEnvConfig(): EnvConfig {
    // 加载 Moralis API Keys
    const moralisApiKeys: string[] = []
    const keyNames = ['MORALIS_API_KEY_1', 'MORALIS_API_KEY_2', 'MORALIS_API_KEY_3']
    
    keyNames.forEach(keyName => {
      const key = process.env[keyName]?.trim()
      if (key) {
        moralisApiKeys.push(key)
      }
    })

    if (moralisApiKeys.length === 0) {
      throw new Error(
        '未找到 Moralis API Keys！请设置环境变量：\n' +
        '- MORALIS_API_KEY_1\n' +
        '- MORALIS_API_KEY_2\n' +
        '- MORALIS_API_KEY_3'
      )
    }

    return {
      moralisApiKeys,
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'debug',
      cacheTTL: parseInt(process.env.CACHE_TTL || '3600'),
      apiTimeout: parseInt(process.env.API_TIMEOUT || '30000'),
      enableDebugMode: process.env.ENABLE_DEBUG_MODE === 'true',
      enableExperimentalFeatures: process.env.ENABLE_EXPERIMENTAL_FEATURES === 'true',
      enableVerboseLogging: process.env.ENABLE_VERBOSE_LOGGING === 'true'
    }
  }

  /**
   * 获取默认 API 配置（移除对 api.json 的依赖）
   */
  private loadAPIConfig(): APIConfig {
    const defaultConfig: APIConfig = {
      http: {
        rateLimit: {
          requestsPerSecond: 30,  // 提高 HTTP 客户端的速率限制
          burstSize: 50,
          timeWindow: 1000
        },
        concurrency: {
          maxConcurrentRequests: 30,  // 提高并发数
          queueTimeout: 30000
        },
        retry: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000
        },
        timeout: {
          default: 30000
        },
        headers: {
          "User-Agent": "BN-Alpha-Tool/1.0.0",
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      },
      batch: {
        defaultBatchSize: 10,
        maxBatchSize: 50,
        batchTimeout: 60000
      },
      cache: {
        defaultTTL: 3600,
        maxSize: 1000,
        cleanupInterval: 300000
      }
    }

    logger.debug('general', '✅ 使用默认 API 配置（HTTP 客户端）')
    return defaultConfig
  }

  // 移除了 loadAppConfig 方法

  /**
   * 验证 API 配置（简化版本，因为使用默认配置）
   */
  private validateAPIConfig(config: APIConfig): void {
    // 基本验证，确保关键配置存在
    if (!config.http?.rateLimit?.requestsPerSecond ||
        !config.http?.concurrency?.maxConcurrentRequests) {
      throw new Error('API 配置缺少必要参数')
    }
    logger.debug('general', '✅ API 配置验证通过')
  }

  // 移除了 validateAppConfig 方法

  /**
   * 获取嵌套对象的值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.apiConfig = null
    this.envConfig = null
    logger.debug('general', '🔄 配置已重新加载')
  }

  /**
   * 根据API key数量和分析规模动态计算配置
   */
  getDynamicConfig(apiKeyCount: number, analysisScale: number): DynamicAPIConfig {
    const baseConfig = this.getAPIConfig()

    // 基于API key数量调整并发和速率
    const concurrencyMultiplier = Math.min(apiKeyCount, 3) // 最多3倍
    const maxConcurrentRequests = Math.min(
      baseConfig.http.concurrency.maxConcurrentRequests * concurrencyMultiplier,
      50 // 硬限制
    )

    const requestsPerSecond = Math.min(
      baseConfig.http.rateLimit.requestsPerSecond * concurrencyMultiplier,
      100 // 硬限制
    )

    // 基于分析规模调整批量大小
    const batchSize = this.calculateOptimalBatchSize(analysisScale, apiKeyCount)

    logger.debug('general', `🎯 动态配置计算: API Keys=${apiKeyCount}, 分析规模=${analysisScale}`)
    logger.debug('general', `📊 调整后配置: 并发=${maxConcurrentRequests}, 速率=${requestsPerSecond}, 批量=${batchSize}`)

    return {
      ...baseConfig,
      http: {
        ...baseConfig.http,
        concurrency: {
          ...baseConfig.http.concurrency,
          maxConcurrentRequests
        },
        rateLimit: {
          ...baseConfig.http.rateLimit,
          requestsPerSecond
        }
      },
      batch: {
        ...baseConfig.batch,
        defaultBatchSize: batchSize,
        maxBatchSize: Math.max(batchSize * 2, baseConfig.batch.maxBatchSize)
      }
    }
  }

  /**
   * 计算最优批量大小
   */
  private calculateOptimalBatchSize(analysisScale: number, apiKeyCount: number): number {
    // 基础批量大小
    let batchSize = 10

    if (analysisScale <= 5) {
      batchSize = Math.min(analysisScale, 5) // 小规模：每个钱包一个批次
    } else if (analysisScale <= 20) {
      batchSize = Math.ceil(analysisScale / apiKeyCount) // 中等规模：平均分配
    } else {
      batchSize = Math.min(20, Math.ceil(analysisScale / (apiKeyCount * 2))) // 大规模：更大批次
    }

    return Math.max(1, Math.min(batchSize, 50)) // 限制在1-50之间
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance()

// 便捷方法
export const getAPIConfig = () => configManager.getAPIConfig()
export const getEnvConfig = () => configManager.getEnvConfig()
export const getHttpConfig = () => configManager.getHttpConfig()
export const getDynamicConfig = (apiKeyCount: number, analysisScale: number) =>
  configManager.getDynamicConfig(apiKeyCount, analysisScale)
