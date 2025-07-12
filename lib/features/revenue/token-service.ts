/**
 * 代币服务 - 代币余额和价格查询
 * 纯业务逻辑服务，不负责配置加载和初始化
 */

import { ethers } from 'ethers'
import { logger } from "@/lib/core/logger"
import type { TokenDataOfNetwork } from '@/lib/core/token-manager'

// 代币余额信息接口
export interface TokenBalance {
    symbol: string
    contractAddress: string
    balance: string
    balanceFormatted: string
    decimals?: number
    isNative: boolean
}

// 代币余额映射表，按符号索引
export interface TokenBalanceMap {
    [symbol: string]: TokenBalance
}

// 代币价格信息接口
export interface TokenPriceInfo {
    symbol: string
    contractAddress: string
    price: number
    isNative: boolean
}

// 代币价格映射表，按符号索引
export interface TokenPriceMap {
    [symbol: string]: TokenPriceInfo
}

// 代币余额分析结果
export interface TokenBalanceAnalysis {
    balances: TokenBalanceMap
    totalValue: number
    hasApiError: boolean      // 是否有API调用失败
    errorCount: number        // 失败的API调用数量
    successCount: number      // 成功的API调用数量
    errorDetails: string[]    // 错误详情
}

/**
 * 代币服务类
 * 纯业务逻辑，接收外部依赖
 */
export class TokenService {

    /**
    * 获取代币价格并缓存到网络数据中
    * @param httpClient HTTP 客户端实例
    * @param tokenNetworks 代币网络数据（外部传入，避免重复加载）
    * @returns 无返回值，价格直接缓存到代币对象上
    */
    static async getAndCacheTokenPrices(
        httpClient: any,
        tokenDataOfNetworks: { [networkId: string]: TokenDataOfNetwork }
    ): Promise<void> {
        logger.debug('general', `🔍 获取全局代币价格（最新）`)

        try {
            for (const tokenData of Object.values(tokenDataOfNetworks)) {

                const allTokens = [
                    {
                        address: tokenData.nativeToken.address,
                        symbol: tokenData.nativeToken.symbol,
                        isNative: true,
                        tokenObj: tokenData.nativeToken
                    },
                    ...Object.values(tokenData.erc20Tokens).map((token: any) => ({
                        address: token.address,
                        symbol: token.symbol,
                        isNative: false,
                        tokenObj: token
                    }))
                ]

                if (allTokens.length === 0) continue

                const tokens = allTokens.map(token => ({
                    "tokenAddress": token.address,
                    "exchange": "pancakeswapv3"
                }))

                try {
                    // 使用 HTTP 客户端直接调用 Moralis Token Prices API
                    const params = new URLSearchParams({
                        chain: tokenData.chainIdHex,
                        include: 'percent_change'
                    })
                    const url = `https://deep-index.moralis.io/api/v2.2/erc20/prices?${params.toString()}`

                    logger.debug('general', `🔄 直接调用 Moralis Token Prices API: ${tokenData.network} (${tokens.length} tokens)`)

                    const response = await httpClient.post(url, {
                        tokens: tokens.map(token => ({
                            token_address: token.tokenAddress,
                            exchange: token.exchange
                        }))
                    })

                    if (!response.ok) {
                        throw new Error(`Token Prices API 请求失败: ${response.status} ${response.statusText}`)
                    }

                    const result = await response.json()
                    if (!result || typeof result !== 'object') {
                        throw new Error('API 返回数据格式错误')
                    }

                    if (result && Array.isArray(result)) {
                        for (const priceData of result) {
                            const tokenAddress = priceData.tokenAddress?.toLowerCase()
                            const usdPrice = priceData.usdPrice

                            if (tokenAddress && usdPrice !== undefined) {
                                const tokenInfo = allTokens.find(t =>
                                    t.address.toLowerCase() === tokenAddress
                                )

                                if (tokenInfo) {
                                    const price = typeof usdPrice === 'string' ? parseFloat(usdPrice) : usdPrice

                                    // 直接将价格缓存到代币对象上
                                    tokenInfo.tokenObj.price = price
                                }
                            }
                        }
                    }
                } catch (error) {
                    logger.debug('general', `❌ 获取 ${tokenData.network} 代币价格失败: ${error}`)
                }
            }

            logger.debug('general', `✅ 代币价格查询完成，价格已缓存到代币对象中`)

        } catch (error) {
            logger.debug('general', `❌ 代币价格查询失败: ${error}`)
            throw error
        }
    }

    /**
     * 获取代币余额并计算总价值
     * @param walletAddress 钱包地址
     * @param httpClient HTTP 客户端实例
     * @param tokenNetworks 代币网络数据（价格已缓存在代币对象中）
     * @returns 代币余额分析结果
     */
    static async getTokenBalances(
        walletAddress: string,
        httpClient: any,
        tokenDataOfNetworks: { [networkId: string]: TokenDataOfNetwork }
    ): Promise<TokenBalanceAnalysis> {
        try {
            const balanceMap: TokenBalanceMap = {}
            let totalValue = 0
            let validTokenCount = 0

            // 跟踪API调用状态
            let errorCount = 0
            let successCount = 0
            let errorDetails: string[] = []

            for (const tokenData of Object.values(tokenDataOfNetworks)) {

                // 从网络数据中读取最新的区块号
                let blockNumber: number | undefined
                if (tokenData.blockRanges) {
                    blockNumber = tokenData.blockRanges.endBlock
                }

                if (!blockNumber) {
                    logger.debug('general', `⚠️ 未找到网络 ${tokenData.network} 的区块范围数据`)
                    continue
                }

                const currentBlockNumber = blockNumber

                // 1. 查询原生代币余额
                try {
                    // 使用 HTTP 客户端直接调用 Moralis Native Balance API
                    const params = new URLSearchParams({
                        chain: tokenData.chainIdHex,
                        toBlock: currentBlockNumber.toString()
                    })
                    const url = `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance?${params.toString()}`

                    logger.debug('general', `🔄 直接调用 Moralis Native Balance API: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`)

                    const response = await httpClient.get(url)

                    if (!response.ok) {
                        throw new Error(`Native Balance API 请求失败: ${response.status} ${response.statusText}`)
                    }

                    const result = await response.json()
                    if (!result || typeof result !== 'object') {
                        throw new Error('API 返回数据格式错误')
                    }

                    const balance = result.balance?.toString() || "0"
                    const balanceFormatted = ethers.formatEther(balance)

                                        if (balance !== "0") {
                        const tokenBalance = {
                            symbol: tokenData.nativeToken.symbol,
                            contractAddress: tokenData.nativeToken.address,
                            balance,
                            balanceFormatted,
                            decimals: tokenData.nativeToken.decimals || 18,
                            isNative: true
                        }
                        
                        balanceMap[tokenData.nativeToken.symbol] = tokenBalance
                        
                        // 直接计算价值
                        const balanceAmount = parseFloat(balanceFormatted)
                        const price = tokenData.nativeToken.price
                        if (price && balanceAmount > 0) {
                            const value = balanceAmount * price
                            totalValue += value
                            validTokenCount++
                            logger.debug('general', `💎 ${tokenData.nativeToken.symbol}: ${balanceFormatted} × $${price.toFixed(4)} = $${value.toFixed(2)}`)
                        }
                    }
                    successCount++
                } catch (error) {
                    errorCount++
                    const errorMsg = `获取${tokenData.nativeToken.symbol}余额失败: ${error}`
                    errorDetails.push(errorMsg)
                    logger.debug('general', `❌ ${errorMsg}`)
                }

                // 2. 查询ERC20代币余额
                if (Object.keys(tokenData.erc20Tokens).length > 0) {
                    try {
                        const addressToTokenMap = new Map<string, any>()
                        const tokenAddresses: string[] = []

                        Object.values(tokenData.erc20Tokens).forEach((token: any) => {
                            const lowerAddress = token.address.toLowerCase()
                            addressToTokenMap.set(lowerAddress, token)
                            tokenAddresses.push(token.address)
                        })

                        // 使用 HTTP 客户端直接调用 Moralis ERC20 Token Balances API
                        const params = new URLSearchParams({
                            chain: tokenData.chainIdHex,
                            toBlock: currentBlockNumber.toString()
                        })

                        // 添加多个 token_addresses 参数
                        tokenAddresses.forEach(address => {
                            params.append('token_addresses', address)
                        })

                        const url = `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?${params.toString()}`

                        logger.debug('general', `🔄 直接调用 Moralis ERC20 Token Balances API: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} (${tokenAddresses.length} tokens)`)

                        const response = await httpClient.get(url)

                        if (!response.ok) {
                            throw new Error(`ERC20 Token Balances API 请求失败: ${response.status} ${response.statusText}`)
                        }

                        const result = await response.json()
                        if (!result || typeof result !== 'object') {
                            throw new Error('API 返回数据格式错误')
                        }

                        const tokenBalances = Array.isArray(result) ? result : (result.result || [])

                        for (const tokenData of tokenBalances) {
                            if (!tokenData.token_address) continue

                            const contractAddress = tokenData.token_address.toLowerCase()
                            const balance = tokenData.balance
                            const decimals = tokenData.decimals

                            const tokenInfo = addressToTokenMap.get(contractAddress)

                            if (tokenInfo && balance !== "0") {
                                const balanceFormatted = ethers.formatUnits(balance, decimals)

                                const tokenBalance = {
                                    symbol: tokenInfo.symbol,
                                    contractAddress: tokenInfo.address,
                                    balance,
                                    balanceFormatted,
                                    decimals,
                                    isNative: false
                                }

                                balanceMap[tokenInfo.symbol] = tokenBalance
                                
                                // 直接计算价值
                                const balanceAmount = parseFloat(balanceFormatted)
                                const price = tokenInfo.price
                                if (price && balanceAmount > 0) {
                                    const value = balanceAmount * price
                                    totalValue += value
                                    validTokenCount++
                                    logger.debug('general', `💎 ${tokenInfo.symbol}: ${balanceFormatted} × $${price.toFixed(4)} = $${value.toFixed(2)}`)
                                }
                            }
                        }
                        successCount++
                    } catch (error) {
                        errorCount++
                        const errorMsg = `获取ERC20代币余额失败: ${error}`
                        errorDetails.push(errorMsg)
                        logger.debug('general', `❌ ${errorMsg}`)
                    }
                }
            }

            const tokenCount = Object.keys(balanceMap).length
            const hasApiError = errorCount > 0

            logger.debug('general', `✅ 找到 ${tokenCount} 种有余额的代币`)
            logger.debug('general', `✅ 计算完成: ${validTokenCount} 个代币，总价值 $${totalValue.toFixed(2)}`)
            logger.debug('general', `📊 API调用统计: 成功${successCount}次，失败${errorCount}次`)

            if (hasApiError) {
                logger.debug('general', `⚠️ 存在API调用失败，错误详情: ${errorDetails.join('; ')}`)
            }

            return {
                balances: balanceMap,
                totalValue: totalValue,
                hasApiError,
                errorCount,
                successCount,
                errorDetails
            }

        } catch (error) {
            logger.debug('general', `❌ 代币余额查询失败: ${error}`)
            throw error
        }
    }
}