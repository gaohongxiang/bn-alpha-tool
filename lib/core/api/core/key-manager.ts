import { logger } from "@/lib/core/logger"
import type { APIKeyInfo, APIKeyStats } from './types'

export class APIKeyManager {
    private keys: Map<string, APIKeyInfo> = new Map()
    private currentIndex: number = 0
    private readonly rotationInterval: number = 1000 // 轮换间隔（毫秒）
    private lastRotation: number = Date.now()
    private readonly maxFailureCount: number = 5 // 最大失败次数
    private readonly recoveryTime: number = 300000 // 恢复时间（5分钟）

    constructor(keys: string[]) {
        if (!keys || keys.length === 0) {
            throw new Error('至少需要提供一个API Key')
        }

        // 过滤和验证keys
        const validKeys = keys.filter(key => key && key.trim().length > 0)
        if (validKeys.length === 0) {
            throw new Error('没有有效的API Key')
        }

        this.initializeKeys(validKeys)
        logger.debug('general', `[APIKeyManager] 初始化完成，加载了 ${validKeys.length} 个有效Key`)
    }

    /**
     * 从环境变量加载API Keys
     */
    static fromEnv(baseKey: string): APIKeyManager {
        const keys: string[] = []
        let index = 1

        // 获取环境变量对象
        const env = typeof window === 'undefined' ? process.env : (window as any).env
        if (!env) {
            logger.debug('general', '❌ 环境变量对象未定义!')
            throw new Error('环境变量对象未定义')
        }

        // 收集所有带数字后缀的key
        while (true) {
            const envKey = `${baseKey}_${index}`
            const key = env[envKey]
            
            if (!key) {
                logger.debug('general', `❌ ${envKey} 未找到，停止搜索`)
                break
            }
            
            const trimmedKey = key.trim()
            keys.push(trimmedKey)
            logger.debug('general', `✅ ${envKey} 已加载 (长度: ${trimmedKey.length})`)
            
            index++
        }

        if (keys.length === 0) {
            logger.debug('general', `❌ 错误：未找到任何 ${baseKey} 相关的API Keys`)
            throw new Error(`未配置${baseKey}相关的API Keys`)
        }

        logger.debug('general', `✅ 成功加载了 ${keys.length} 个API Key`)
        return new APIKeyManager(keys)
    }

    /**
     * 初始化密钥信息
     */
    private initializeKeys(keys: string[]): void {
        keys.forEach((key, index) => {
            this.keys.set(key, {
                key: key.trim(),
                isActive: true,
                stats: {
                    total: keys.length,
                    failed: 0,
                    current: index,
                    lastUsed: 0,
                    errorCount: 0,
                    successCount: 0
                },
                lastError: undefined,
                lastSuccess: undefined
            })
        })
    }

    /**
     * 获取当前可用的API Key
     */
    getCurrentKey(): string {
        const now = Date.now()

        // 检查是否需要轮换
        if (now - this.lastRotation >= this.rotationInterval) {
            this.rotate()
        }

        // 尝试恢复失败的密钥
        this.tryRecoverFailedKeys(now)

        // 获取所有活跃的密钥，按优先级排序
        const activeKeys = Array.from(this.keys.values())
            .filter(info => info.isActive)
            .sort((a, b) => {
                // 优先使用成功率高的key
                const aSuccessRate = a.stats.successCount / Math.max(1, a.stats.successCount + a.stats.errorCount)
                const bSuccessRate = b.stats.successCount / Math.max(1, b.stats.successCount + b.stats.errorCount)

                if (Math.abs(aSuccessRate - bSuccessRate) > 0.1) {
                    return bSuccessRate - aSuccessRate
                }

                // 其次使用最久未使用的key
                return (a.stats.lastUsed || 0) - (b.stats.lastUsed || 0)
            })

        if (activeKeys.length === 0) {
            // 如果没有活跃的key，强制重置所有key
            logger.debug('general', '⚠️ 没有可用的API Key，强制重置所有Key')
            this.forceResetAllKeys()
            return this.getCurrentKey()
        }

        // 使用最优的密钥
        const selectedKey = activeKeys[0]
        selectedKey.stats.lastUsed = now
        selectedKey.stats.current++

        logger.debug('general', `🔑 使用 API Key (长度: ${selectedKey.key.length}, 成功率: ${this.getSuccessRate(selectedKey)}%)`)
        return selectedKey.key
    }

    /**
     * 计算成功率
     */
    private getSuccessRate(keyInfo: APIKeyInfo): number {
        const total = keyInfo.stats.successCount + keyInfo.stats.errorCount
        if (total === 0) return 100
        return Math.round((keyInfo.stats.successCount / total) * 100)
    }

    /**
     * 尝试恢复失败的密钥
     */
    private tryRecoverFailedKeys(now: number): void {
        this.keys.forEach(info => {
            if (!info.isActive && info.lastError) {
                const timeSinceLastError = now - (info.stats.lastUsed || 0)
                if (timeSinceLastError >= this.recoveryTime) {
                    info.isActive = true
                    info.stats.errorCount = Math.floor(info.stats.errorCount / 2) // 减半错误计数
                    logger.debug('general', `🔄 恢复API Key (长度: ${info.key.length})`)
                }
            }
        })
    }

    /**
     * 强制重置所有密钥
     */
    private forceResetAllKeys(): void {
        this.keys.forEach(info => {
            info.isActive = true
            info.stats.errorCount = 0
            info.stats.failed = 0
            info.lastError = undefined
        })
        logger.debug('general', '🔄 强制重置所有API Key')
    }

    /**
     * 标记密钥成功使用
     */
    markSuccess(key: string): void {
        const info = this.keys.get(key)
        if (info) {
            info.stats.successCount++
            info.lastSuccess = Date.now()
            logger.debug('general', `✅ API Key 使用成功 (成功次数: ${info.stats.successCount})`)
        }
    }

    /**
     * 标记密钥使用失败
     */
    markFailure(key: string, error?: string): void {
        const info = this.keys.get(key)
        if (info) {
            info.stats.errorCount++
            info.stats.failed++
            info.lastError = error

            // 根据错误类型决定是否立即停用
            const shouldDisableImmediately = this.shouldDisableImmediately(error)

            if (shouldDisableImmediately || info.stats.errorCount >= this.maxFailureCount) {
                info.isActive = false
                const reason = shouldDisableImmediately ? '严重错误' : `错误次数过多(${info.stats.errorCount})`
                logger.debug('general', `❌ API Key 暂时停用 (${reason}): ${error?.substring(0, 100)}`)
            } else {
                logger.debug('general', `⚠️ API Key 错误 (${info.stats.errorCount}/${this.maxFailureCount}): ${error?.substring(0, 50)}`)
            }
        }
    }

    /**
     * 判断是否应该立即停用密钥
     */
    private shouldDisableImmediately(error?: string): boolean {
        if (!error) return false

        const errorLower = error.toLowerCase()
        return errorLower.includes('invalid api key') ||
               errorLower.includes('unauthorized') ||
               errorLower.includes('forbidden') ||
               errorLower.includes('api key not found') ||
               errorLower.includes('authentication failed')
    }

    /**
     * 轮换到下一个密钥
     */
    private rotate(): void {
        this.currentIndex = (this.currentIndex + 1) % this.keys.size
        this.lastRotation = Date.now()
        logger.debug('general', '🔄 API Key 轮换完成')
    }

    /**
     * 重置所有失败的密钥
     */
    private resetFailedKeys(): void {
        this.keys.forEach(info => {
            info.isActive = true
            info.stats.errorCount = 0
            info.stats.failed = 0
        })
        logger.debug('general', '🔄 已重置所有失败的API Key')
    }

    /**
     * 获取密钥管理器状态
     */
    getStats(): APIKeyStats {
        const stats = {
            total: this.keys.size,
            failed: Array.from(this.keys.values()).filter(info => !info.isActive).length,
            current: this.currentIndex + 1,
            lastUsed: 0,
            errorCount: 0,
            successCount: 0
        }

        this.keys.forEach(info => {
            stats.errorCount += info.stats.errorCount
            stats.successCount += info.stats.successCount
            stats.lastUsed = Math.max(stats.lastUsed, info.stats.lastUsed)
        })

        return stats
    }

    /**
     * 重置所有状态
     */
    reset(): void {
        this.currentIndex = 0
        this.lastRotation = Date.now()
        this.initializeKeys(Array.from(this.keys.keys()))
        logger.debug('general', '🔄 API Key管理器已重置')
    }
} 