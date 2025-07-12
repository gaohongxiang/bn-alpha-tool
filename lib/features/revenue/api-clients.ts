/**
 * Revenue 系统 API 客户端管理
 * 统一初始化和管理 HTTP 客户端实例
 */

import { createHttpClient, type HttpClient } from '../../core/api'
import { logger } from "@/lib/core/logger"
import { getHttpConfig, getDynamicConfig, getEnvConfig } from '../../core/config-manager'

/**
 * 获取统一配置 - 支持动态调整
 */
function getUnifiedConfig(analysisScale?: number) {
    // 获取API key数量
    const envConfig = getEnvConfig()
    const apiKeyCount = envConfig.moralisApiKeys.length

    // 如果提供了分析规模，使用动态配置
    if (analysisScale && analysisScale > 0) {
        const dynamicConfig = getDynamicConfig(apiKeyCount, analysisScale)
        logger.debug('general', `🎯 使用动态配置: API Keys=${apiKeyCount}, 分析规模=${analysisScale}`)

        return {
            http: {
                apiKeys: envConfig.moralisApiKeys,
                maxConcurrency: dynamicConfig.http.concurrency.maxConcurrentRequests,
                rateLimit: {
                    requestsPerSecond: dynamicConfig.http.rateLimit.requestsPerSecond,
                    burstSize: dynamicConfig.http.rateLimit.burstSize,
                    timeWindow: dynamicConfig.http.rateLimit.timeWindow
                },
                error: {
                    maxRetries: dynamicConfig.http.retry.maxRetries,
                    baseDelay: dynamicConfig.http.retry.baseDelay,
                    maxDelay: dynamicConfig.http.retry.maxDelay
                },
                timeout: dynamicConfig.http.timeout.default,
                baseHeaders: dynamicConfig.http.headers
            }
        }
    }

    // 否则使用静态配置
    const httpConfig = getHttpConfig()
    logger.debug('general', `📊 使用静态配置: API Keys=${apiKeyCount}`)

    return {
        http: {
            apiKeys: envConfig.moralisApiKeys,
            maxConcurrency: httpConfig.concurrency.maxConcurrentRequests,
            rateLimit: {
                requestsPerSecond: httpConfig.rateLimit.requestsPerSecond,
                burstSize: httpConfig.rateLimit.burstSize,
                timeWindow: httpConfig.rateLimit.timeWindow
            },
            error: {
                maxRetries: httpConfig.retry.maxRetries,
                baseDelay: httpConfig.retry.baseDelay,
                maxDelay: httpConfig.retry.maxDelay
            },
            timeout: httpConfig.timeout.default,
            baseHeaders: httpConfig.headers
        }
    }
}

/**
 * API 客户端配置类型
 */
interface APIClientConfig {
    http: ReturnType<typeof getUnifiedConfig>['http']
}

/**
 * API 客户端管理器
 * 负责创建和管理 HTTP 客户端实例
 */
export class APIClientManager {
    private static httpClient: HttpClient | null = null
    private static config: Partial<APIClientConfig> = {}

    /**
     * 获取 HTTP 客户端实例（支持动态配置）
     */
    static getHttpClient(analysisScale?: number): HttpClient {
        try {
            // 如果提供了分析规模且与当前配置不同，重新创建客户端
            if (analysisScale && analysisScale > 0) {
                const config = getUnifiedConfig(analysisScale)
                this.httpClient = createHttpClient(config.http)
                logger.debug('general', `✅ HTTP 客户端初始化完成 (动态配置: 分析规模=${analysisScale})`)
                return this.httpClient
            }

            // 否则使用单例模式
            if (!this.httpClient) {
                const config = getUnifiedConfig()
                this.httpClient = createHttpClient(config.http)
                logger.debug('general', '✅ HTTP 客户端初始化完成 (静态配置)')
            }
            return this.httpClient
        } catch (error) {
            logger.debug('general', '❌ HTTP 客户端初始化失败:', error)
            throw new Error(`HTTP 客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }





    /**
     * 重置所有客户端（用于测试）
     */
    static reset(): void {
        try {
            if (this.httpClient) {
                this.httpClient.cleanup()
            }
            this.httpClient = null
            this.config = {}  // 重置配置
            logger.debug('general', '🔄 API 客户端已重置')
        } catch (error) {
            logger.debug('general', '⚠️ 重置客户端时发生错误:', error)
            // 强制重置，即使清理失败
            this.httpClient = null
            this.config = {}
        }
    }

    /**
     * 获取当前配置
     */
    static getConfig(): APIClientConfig {
        const unifiedConfig = getUnifiedConfig()
        return {
            http: unifiedConfig.http,
            ...this.config
        }
    }

    /**
     * 获取所有客户端状态
     */
    static getStatus() {
        try {
            return {
                httpClient: this.httpClient ? this.httpClient.getStatus() : null,
                config: this.getConfig()
            }
        } catch (error) {
            logger.debug('general', '⚠️ 获取客户端状态时发生错误:', error)
            return {
                httpClient: null,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    /**
     * 健康检查 - 检查 HTTP 客户端是否正常工作
     */
    static async healthCheck(): Promise<{
        httpClient: boolean
        errors: string[]
    }> {
        const errors: string[] = []
        let httpClientHealthy = false

        // 检查 HTTP 客户端
        try {
            const httpClient = this.getHttpClient()
            httpClientHealthy = !!httpClient
        } catch (error) {
            errors.push(`HTTP 客户端错误: ${error instanceof Error ? error.message : String(error)}`)
        }

        return {
            httpClient: httpClientHealthy,
            errors
        }
    }
}

/**
 * 便捷导出函数 - 带错误处理的包装器，支持动态配置
 */
export const getHttpClient = (analysisScale?: number) => {
    try {
        return APIClientManager.getHttpClient(analysisScale)
    } catch (error) {
        logger.debug('general', '❌ 获取 HTTP 客户端失败:', error)
        throw error
    }
}



/**
 * 安全的客户端获取函数 - 返回 null 而不是抛出错误
 */
export const safeGetHttpClient = (): HttpClient | null => {
    try {
        return APIClientManager.getHttpClient()
    } catch (error) {
        logger.debug('general', '⚠️ 安全获取 HTTP 客户端失败:', error)
        return null
    }
}



/**
 * 导出健康检查和状态查询函数
 */
export const getAPIStatus = () => APIClientManager.getStatus()
export const checkAPIHealth = () => APIClientManager.healthCheck()
export const resetAPIClients = () => APIClientManager.reset()
