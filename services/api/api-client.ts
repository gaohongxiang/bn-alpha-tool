import type { APIResponse, APIKey, APIHealth } from '@/types'
import { DebugLogger } from '../../lib/debug-logger'
import { safeExecute, safeExecuteAsync } from '../../lib/error-handler'

/**
 * 基础API客户端
 * 提供核心的HTTP请求功能和错误处理
 */
export class APIClient {
  private baseUrl: string
  private defaultTimeout: number = 30000

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * 发起HTTP GET请求
   * @param endpoint 端点路径
   * @param params 查询参数
   * @param options 请求选项
   * @returns API响应
   */
  async get<T = any>(
    endpoint: string,
    params: Record<string, any> = {},
    options: { timeout?: number; apiKey?: string } = {}
  ): Promise<APIResponse<T>> {
    const startTime = Date.now()
    
    try {
      const url = this.buildUrl(endpoint, params)
      const timeout = options.timeout || this.defaultTimeout

      DebugLogger.log(`🌐 API请求: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; BN-Alpha-Tool/1.0)',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        signal: AbortSignal.timeout(timeout)
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      DebugLogger.log(`✅ API响应成功 (${responseTime}ms)`)

      return {
        success: true,
        data,
        responseTime,
        keyUsed: options.apiKey
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      DebugLogger.error(`❌ API请求失败 (${responseTime}ms):`, errorMessage)

      return {
        success: false,
        error: errorMessage,
        responseTime,
        keyUsed: options.apiKey
      }
    }
  }

  /**
   * 发起POST请求（如果需要）
   */
  async post<T = any>(
    endpoint: string,
    data: Record<string, any> = {},
    options: { timeout?: number; apiKey?: string } = {}
  ): Promise<APIResponse<T>> {
    const startTime = Date.now()
    
    try {
      const url = this.buildUrl(endpoint)
      const timeout = options.timeout || this.defaultTimeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(timeout)
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseData = await response.json()

      return {
        success: true,
        data: responseData,
        responseTime,
        keyUsed: options.apiKey
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      return {
        success: false,
        error: errorMessage,
        responseTime,
        keyUsed: options.apiKey
      }
    }
  }

  /**
   * 构建请求URL
   */
  private buildUrl(endpoint: string, params: Record<string, any> = {}): string {
    const url = new URL(endpoint, this.baseUrl)
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

    return url.toString()
  }

  /**
   * 设置默认超时时间
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout
  }
} 