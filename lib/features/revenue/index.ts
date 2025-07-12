/**
 * Revenue 分析器 - 新版本
 * 使用新的 API 基础设施重新实现
 */

import { TokenService, type TokenBalanceMap, type TokenPriceMap } from './token-service'
import { TransactionService } from './transaction-service'
import type { TransactionSummary } from '@/types'
import { tokenManager, type TokenDataOfNetwork, type BlockRangeInfo } from '../../core/token-manager'
import { logger } from '../../core/logger'
import { BlockRange } from './block-range'
import { validateAndCleanWalletAddress, validateAndCleanDateString } from '../../core/utils'
// 使用新的 API 客户端管理器
import { getHttpClient, APIClientManager } from './api-clients'
import type { SimpleBatchConfig } from '../../core/api'

/**
 * 钱包收益快照
 */
export interface WalletRevenueSnapshot {
    walletAddress: string
    queryDate: string
    tokensValue: number
    transactionData?: TransactionSummary
    error?: string  // 添加错误信息字段
}

/**
 * 批量分析配置
 */
export interface BatchAnalysisConfig extends SimpleBatchConfig {
    includeSwaps?: boolean
    chainId?: string
    useSDK?: boolean
    forceRefresh?: boolean
}

/**
 * Revenue 分析器
 */
export class RevenueAnalyzer {
    /**
     * 缓存的代币网络数据
     */
    private static tokenDataOfNetworks: { [networkId: string]: TokenDataOfNetwork } | null = null

    /**
     * 初始化 Promise（防止并发初始化）
     */
    private static initializationPromise: Promise<void> | null = null

    /**
     * 主入口：批量分析多个钱包收益（使用新 API 系统）
     * @param walletAddresses 钱包地址数组
     * @param dateStr 日期 (YYYY-MM-DD)
     * @param config 批量分析配置
     * @returns 钱包收益快照数组
     */
    static async analyzeMultipleWallets(
        walletAddresses: string[],
        dateStr: string,
        config?: BatchAnalysisConfig
    ): Promise<WalletRevenueSnapshot[]> {
        if (!walletAddresses || walletAddresses.length === 0) {
            throw new Error('钱包地址列表不能为空')
        }

        logger.debug('revenue-analyzer', `\n=== 🚀 批量分析 ${walletAddresses.length} 个钱包收益（新API系统） ===`)
        logger.debug('revenue-analyzer', `📅 查询日期: ${dateStr}`)
        logger.debug('revenue-analyzer', `⚙️ 配置: ${JSON.stringify(config || {})}`)

        // 验证并清理输入
        const cleanDateStr = validateAndCleanDateString(dateStr)
        const cleanWalletAddresses = walletAddresses.map(address => {
            try {
                return validateAndCleanWalletAddress(address)
            } catch (error) {
                logger.debug('revenue-analyzer', `❌ 钱包地址 ${address} 格式无效: ${error}`)
                throw error
            }
        })

        const startTime = Date.now()

        try {
            // 1. 确保系统初始化
            await this.ensureSystemInitialized()

            // 2. 获取 HTTP 客户端用于批量操作（使用动态配置）
            const analysisScale = cleanWalletAddresses.length
            const httpClient = getHttpClient(analysisScale)
            logger.debug('revenue-analyzer', `🎯 使用动态配置: 分析规模=${analysisScale}`)

            // 3. 创建钱包分析任务（使用完整的业务逻辑）
            logger.debug('revenue-analyzer', `📦 创建钱包分析任务...`)
            const forceRefresh = config?.forceRefresh || false
            const walletTasks = cleanWalletAddresses.map((address, index) => {
                logger.debug('revenue-analyzer', `📝 任务 ${index + 1}: ${address.slice(0, 6)}...${address.slice(-4)}`)
                return () => this.analyzeWalletRevenue(address, cleanDateStr, forceRefresh) // 传递正确的forceRefresh参数
            })

            logger.debug('revenue-analyzer', `📦 创建了 ${walletTasks.length} 个钱包分析任务`)

            // 4. 直接并行执行钱包分析任务
            logger.debug('revenue-analyzer', `🎯 开始并行分析钱包...`)
            const startTime = Date.now()

            const results = await Promise.allSettled(
                walletTasks.map(async (task, index) => {
                    try {
                        const result = await task()
                        const progress = ((index + 1) / walletTasks.length) * 100
                        logger.debug('revenue-analyzer', `📊 分析进度: ${progress.toFixed(1)}% (${index + 1}/${walletTasks.length})`)
                        config?.progressCallback?.(progress, index + 1, walletTasks.length)
                        return result
                    } catch (error) {
                        logger.debug('revenue-analyzer', `❌ 钱包分析失败: ${error}`)
                        throw error
                    }
                })
            )

            // 5. 处理结果
            const revenueSnapshots: WalletRevenueSnapshot[] = []
            let successCount = 0
            let failCount = 0

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    revenueSnapshots.push(result.value)
                    successCount++
                } else {
                    const address = cleanWalletAddresses[index]
                    const error = result.status === 'rejected' ? result.reason : 'Unknown error'
                    logger.debug('revenue-analyzer', `❌ 钱包 ${address?.slice(0, 6)}...${address?.slice(-4)} 分析失败: ${error}`)
                    failCount++

                    // 创建失败的快照占位符，包含错误信息
                    const failedSnapshot: WalletRevenueSnapshot = {
                        walletAddress: address || 'unknown',
                        queryDate: cleanDateStr,
                        tokensValue: 0,
                        transactionData: undefined,
                        error: error || '查询失败'  // 添加错误信息
                    }
                    revenueSnapshots.push(failedSnapshot)
                }
            })

            const totalTime = Date.now() - startTime
            const avgTime = totalTime / results.length

            logger.debug('revenue-analyzer', `\n=== ✅ 批量分析完成 ===`)
            logger.debug('revenue-analyzer', `📊 成功: ${successCount}，失败: ${failCount}`)
            logger.debug('revenue-analyzer', `⏱️ 总耗时: ${totalTime/1000}s，平均: ${avgTime/1000}s/钱包`)



            return revenueSnapshots

        } catch (error) {
            logger.debug('revenue-analyzer', `❌ 批量分析失败: ${error}`)
            throw error
        }
    }

    /**
     * 获取钱包收益快照（核心业务逻辑）
     * 复制原来的 captureWalletSnapshot 完整逻辑
     */
    private static async captureWalletSnapshot(
        walletAddress: string,
        dateStr: string,
        forceRefresh?: boolean
    ): Promise<WalletRevenueSnapshot> {
        logger.debug('revenue-analyzer', `\n=== 🚀 获取钱包收益快照 ===`)
        logger.debug('revenue-analyzer', `👛 ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`)

        try {
            // Step 1: 确保系统初始化完成
            logger.debug('revenue-analyzer', `🔧 Step 1: 确保系统初始化完成`)
            await this.ensureSystemInitialized()

            // Step 2: 获取统一的依赖
            logger.debug('revenue-analyzer', `🔧 Step 2: 获取统一的依赖`)
            const httpClient = getHttpClient()
            const tokenDataOfNetworks = await this.getTokenNetworkData()

            // Step 3: 处理强制刷新（批量查询重新开始）
            if (forceRefresh) {
                logger.debug('revenue-analyzer', `🔧 Step 3: 处理强制刷新`)
                this.clearDataForNewQuery(tokenDataOfNetworks)
            }

            // Step 4: 获取区块范围并保存到网络数据中，多钱包共用
            logger.debug('revenue-analyzer', `🔧 Step 4: 获取区块范围`)
            // 使用 HTTP 客户端直接调用 Moralis DateToBlock API
            const blockRanges = await BlockRange.getBlockRangesForAllNetworks(dateStr, httpClient, tokenDataOfNetworks)

            // Step 5: 获取全局代币价格（缓存）多钱包共用
            logger.debug('revenue-analyzer', `🔧 Step 5: 获取代币价格...`)
            await TokenService.getAndCacheTokenPrices(httpClient, tokenDataOfNetworks)
            logger.debug('revenue-analyzer', `✅ 代币价格获取完成`)

            // Step 6-7: 并行执行余额查询和交易分析（优化性能）
            logger.debug('revenue-analyzer', `🔧 Step 6-7: 并行执行余额查询和交易分析`)
            const [balanceAnalysis, transactionData] = await Promise.all([
                // 并行任务1: 代币余额查询和价值计算
                TokenService.getTokenBalances(walletAddress, httpClient, tokenDataOfNetworks),
                // 并行任务2: 交易历史分析
                TransactionService.getWalletTransactions(
                    walletAddress,
                    null,  // 不再使用 Moralis 实例
                    httpClient,        // 👈 传入 HTTP 客户端（swap数据没有sdk，要用http请求）
                    tokenDataOfNetworks
                )
            ])

            logger.debug('revenue-analyzer', `💰 余额分析完成: $${balanceAnalysis.totalValue.toFixed(2)}`)
            logger.debug('revenue-analyzer', `📊 交易数据获取完成: ${transactionData?.buyTransactionsCount || 0} 笔交易`)

            // Step 8: 智能失败检测（基于API调用状态）
            logger.debug('revenue-analyzer', `🔧 Step 8: 智能失败检测`)
            let hasFailure = false
            let failureReasons: string[] = []

            // 检测余额查询API失败
            if (balanceAnalysis.hasApiError) {
                hasFailure = true
                failureReasons.push('余额查询API失败')
                logger.debug('revenue-analyzer', `❌ 余额查询API失败: ${balanceAnalysis.errorDetails.join('; ')}`)
            }

            // 检测交易查询API失败
            if (transactionData.hasApiError) {
                hasFailure = true
                failureReasons.push('交易查询API失败')
                logger.debug('revenue-analyzer', `❌ 交易查询API失败: ${transactionData.errorMessage}`)
            }

            // 如果有API失败，抛出详细错误
            if (hasFailure) {
                const errorMsg = `API调用失败: ${failureReasons.join(', ')}`
                logger.debug('revenue-analyzer', `❌ ${errorMsg}`)
                throw new Error(errorMsg)
            }

            const result = {
                walletAddress,
                queryDate: dateStr,
                tokensValue: balanceAnalysis.totalValue,
                transactionData,
            }

            logger.debug('revenue-analyzer', `✅ 钱包快照完成: 余额=$${result.tokensValue.toFixed(2)}, 交易=${result.transactionData?.buyTransactionsCount || 0}笔`)
            return result

        } catch (error) {
            logger.debug('revenue-analyzer', `\n=== ❌ 快照获取失败 ===`)
            logger.debug('revenue-analyzer', `💥 ${error}`)
            throw error
        }
    }

    /**
     * 单个钱包分析（兼容原有接口）
     * @param walletAddress 钱包地址
     * @param dateStr 日期字符串
     * @param forceRefresh 是否强制刷新（保持兼容性）
     */
    static async analyzeWalletRevenue(
        walletAddress: string,
        dateStr: string,
        forceRefresh: boolean = false
    ): Promise<WalletRevenueSnapshot> {
        // 验证输入
        const cleanWalletAddress = validateAndCleanWalletAddress(walletAddress)
        const cleanDateStr = validateAndCleanDateString(dateStr)

        // 调用核心流程
        return this.captureWalletSnapshot(cleanWalletAddress, cleanDateStr, forceRefresh)
    }

    /**
     * 确保系统初始化
     */
    private static async ensureSystemInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise
            return
        }

        if (this.isSystemInitialized()) {
            return
        }

        this.initializationPromise = this.performSystemInitialization()

        try {
            await this.initializationPromise
        } finally {
            this.initializationPromise = null
        }
    }

    /**
     * 执行系统初始化
     */
    private static async performSystemInitialization(): Promise<void> {
        logger.debug('revenue-analyzer', '🔄 初始化系统...')

        // 1. 初始化代币管理器
        if (!this.isTokenManagerInitialized()) {
            await tokenManager.initialize()
            logger.debug('revenue-analyzer', '✅ 代币管理器初始化完成')
        }

        // 2. 初始化 HTTP 客户端（使用新的客户端管理器）
        getHttpClient()
        logger.debug('revenue-analyzer', '✅ HTTP 客户端初始化完成')

        logger.debug('revenue-analyzer', '✅ 系统初始化完成')
    }

    /**
     * 检查系统是否已初始化
     */
    private static isSystemInitialized(): boolean {
        return this.isTokenManagerInitialized()
    }

    /**
     * 检查代币管理器是否已初始化
     */
    private static isTokenManagerInitialized(): boolean {
        try {
            // 尝试获取配置，如果抛出错误说明未初始化
            tokenManager.getConfig()
            return true
        } catch (error) {
            return false
        }
    }

    /**
     * 获取代币网络数据
     */
    private static async getTokenNetworkData(): Promise<{ [networkId: string]: TokenDataOfNetwork }> {
        if (!this.tokenDataOfNetworks) {
            this.tokenDataOfNetworks = tokenManager.getTokenDataOfNetwork()
            logger.debug('revenue-analyzer', `✅ 加载 ${Object.keys(this.tokenDataOfNetworks).length} 个网络配置`)
        }
        return this.tokenDataOfNetworks
    }

    /**
     * 清除数据以开始新查询
     */
    private static clearDataForNewQuery(tokenDataOfNetworks: { [networkId: string]: TokenDataOfNetwork }): void {
        logger.debug('revenue-analyzer', `🗑️ 重新开始批量查询，清除旧数据...`)

        // 清除代币价格缓存和区块范围缓存
        for (const [networkId, tokenData] of Object.entries(tokenDataOfNetworks)) {
            // 清除原生代币价格
            if (tokenData.nativeToken.price !== undefined) {
                delete tokenData.nativeToken.price
            }

            // 清除 ERC20 代币价格
            for (const [symbol, tokenInfo] of Object.entries(tokenData.erc20Tokens)) {
                if (tokenInfo.price !== undefined) {
                    delete tokenInfo.price
                }
            }

            // 清除区块范围缓存
            if (tokenData.blockRanges) {
                delete tokenData.blockRanges
                logger.debug('revenue-analyzer', `🗑️ 已清除网络 ${networkId} 的区块范围缓存`)
            }
        }

        logger.debug('revenue-analyzer', `✅ 重新查询准备完成`)
    }

    /**
     * 重置系统状态（用于测试）
     */
    static async resetSystem(): Promise<void> {
        this.tokenDataOfNetworks = null
        this.initializationPromise = null

        // 重置 API 客户端管理器
        APIClientManager.reset()

        logger.debug('revenue-analyzer', '🔄 系统状态已重置')
    }

    /**
     * 获取系统状态
     */
    static async getSystemStatus() {
        return {
            tokenManager: this.isTokenManagerInitialized(),
            apiClients: APIClientManager.getStatus(),
            tokenNetworks: this.tokenDataOfNetworks ? Object.keys(this.tokenDataOfNetworks).length : 0
        }
    }
}
