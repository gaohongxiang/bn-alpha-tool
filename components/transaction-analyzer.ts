/**
 * 交易分析器
 * 按指定交易对分析交易磨损和有效交易
 */

import { ethers } from "ethers"
import { configManager, TradingConfigManager } from "../lib/config-manager"
import { TokenPriceUtils } from "./token-price-utils"
import { apiManager } from "./api-manager"
import { TimeUtils, type BlockRange } from "./time-utils"

export interface RawTransaction {
    hash: string
    from: string
    to: string
    value: string
    tokenSymbol: string
    tokenName: string
    tokenDecimal: string
    blockNumber: string
    timeStamp: string
    gasUsed?: string
    gasPrice?: string
}

export interface ExchangeTransaction {
    hash: string
    blockNumber: number
    timestamp: number
    fromToken: string
    toToken: string
    fromAmount: number
    toAmount: number
    gasUsed: number
    gasPrice: number
    gasCost: number  // 实际花费的BNB
}

export interface TradingLossResult {
    // 交易磨损
    tradingLoss: {
        totalSold: number          // 总卖出数量
        totalBought: number        // 总买入数量
        lossAmount: number         // 磨损数量（卖出-买入）
        lossValue: number          // 磨损价值（USDT）
        tokenSymbol: string        // 磨损代币符号
    }

    // Gas磨损
    gasLoss: {
        totalGasUsed: number       // 总Gas消耗
        totalGasCost: number       // 总Gas费用（BNB）  
        totalGasValue: number      // 总Gas价值（USDT）
        bnbPrice: number           // BNB价格
    }

    // 有效交易统计
    validTransactions: {
        count: number              // 有效交易数
        volume: number             // 有效交易额（USDT）
        transactions: ExchangeTransaction[]  // 有效交易列表
    }

    // 所有交易统计
    allExchanges: {
        count: number              // 总兑换交易数
        transactions: ExchangeTransaction[]  // 所有兑换交易
    }
}

export interface TradingPairAnalysisResult {
    pairDescription: string            // 交易对描述
    blockRange: BlockRange            // 分析的区块范围
    walletAddress: string             // 分析的钱包地址
    result: TradingLossResult         // 分析结果
    logs: string[]                    // 分析日志
}

/**
 * 交易对分析器
 * 分析钱包在指定时间范围内的所有交易对交易
 */
export class TradingPairAnalyzer {
    private walletAddress: string
    private logs: string[] = []

    constructor(walletAddress: string) {
        this.walletAddress = walletAddress.toLowerCase()
        this.logs = []
    }

    private addLog(message: string): void {
        console.log(message)
        this.logs.push(message)
    }

    /**
     * 分析指定区块范围内的所有交易对交易
     */
    async analyzeInBlockRange(blockRange: BlockRange): Promise<TradingPairAnalysisResult> {
        this.logs = []
        this.addLog(`🔍 开始分析钱包所有交易对`)
        this.addLog(`📊 钱包地址: ${this.walletAddress}`)
        this.addLog(`🎯 区块范围: ${blockRange.startBlock} - ${blockRange.endBlock}`)

        try {
            // 1. 获取所有交易对的代币交易
            const allTransactions = await this.getAllTradingPairTransactions(blockRange)
            this.addLog(`📋 获取到 ${allTransactions.length} 笔相关代币交易`)

            // 2. 筛选所有交易对的兑换交易
            const exchangeTransactions = await this.filterExchangeTransactions(allTransactions)
            this.addLog(`💱 筛选出 ${exchangeTransactions.length} 笔兑换交易`)

            // 3. 预先计算价格映射表（只构建一次，避免重复计算）
            const transactions = exchangeTransactions.map(ex => ({
                fromToken: ex.fromToken,
                toToken: ex.toToken,
                fromAmount: ex.fromAmount,
                toAmount: ex.toAmount,
                timestamp: ex.timestamp,
                hash: ex.hash
            }))
            const priceMap = await TokenPriceUtils.buildCompletePriceMap(transactions)
            this.addLog(`💰 价格映射表构建完成，包含 ${Object.keys(priceMap).length} 个代币价格`)

            // 4. 计算交易磨损和Gas磨损（传递价格映射表）
            const tradingLoss = await this.calculateTradingLossWithPriceMap(exchangeTransactions, priceMap)

            // 5. 过滤有效交易（排除to为USDT的交易）
            const validTransactions = this.filterValidTransactions(exchangeTransactions)
            const validVolume = await this.calculateValidVolumeWithPriceMap(validTransactions, priceMap)

            this.addLog(`✅ 有效交易: ${validTransactions.length} 笔，总额: $${validVolume.toFixed(2)}`)

            const result: TradingLossResult = {
                tradingLoss,
                gasLoss: await this.calculateGasLoss(exchangeTransactions, priceMap),
                validTransactions: {
                    count: validTransactions.length,
                    volume: validVolume,
                    transactions: validTransactions
                },
                allExchanges: {
                    count: exchangeTransactions.length,
                    transactions: exchangeTransactions
                }
            }

            return {
                pairDescription: `所有交易对`,
                blockRange,
                walletAddress: this.walletAddress,
                result,
                logs: [...this.logs]
            }

        } catch (error) {
            this.addLog(`❌ 分析过程中出现错误: ${error}`)
            throw error
        }
    }

    /**
     * 筛选配置中所有交易对的兑换交易
     */
    private async filterExchangeTransactions(allTransactions: RawTransaction[]): Promise<ExchangeTransaction[]> {
        const exchangeTransactions: ExchangeTransaction[] = []
        const processedHashes = new Set<string>()

        // 获取所有交易对配置
        const allPairs = configManager.getTradingPairs()

        // 按交易hash分组
        const transactionGroups = new Map<string, RawTransaction[]>()
        allTransactions.forEach(tx => {
            if (!transactionGroups.has(tx.hash)) {
                transactionGroups.set(tx.hash, [])
            }
            transactionGroups.get(tx.hash)!.push(tx)
        })

        this.addLog(`🔄 分析 ${transactionGroups.size} 个交易组`)

        for (const [hash, txGroup] of transactionGroups) {
            if (processedHashes.has(hash)) continue

            // 尝试匹配所有交易对
            for (const pair of allPairs) {
                const exchange = await this.analyzeTransactionGroupForPair(hash, txGroup, pair.from, pair.to)
                if (exchange) {
                    exchangeTransactions.push(exchange)
                    processedHashes.add(hash)
                    this.addLog(`✅ 发现交易对 ${pair.from}->${pair.to}: ${exchange.fromAmount.toFixed(6)} ${pair.from} -> ${exchange.toAmount.toFixed(6)} ${pair.to}`)
                    break // 一个交易只匹配一个交易对
                }
            }
        }

        // 按交易对分组统计
        const pairStats = new Map<string, number>()
        exchangeTransactions.forEach(tx => {
            const pairKey = `${tx.fromToken}->${tx.toToken}`
            pairStats.set(pairKey, (pairStats.get(pairKey) || 0) + 1)
        })

        this.addLog(`📊 交易对统计:`)
        for (const [pair, count] of pairStats) {
            this.addLog(`   ${pair}: ${count}笔`)
        }

        return exchangeTransactions
    }

    /**
     * 获取所有交易对在指定区块范围内的交易
     */
    private async getAllTradingPairTransactions(blockRange: BlockRange): Promise<RawTransaction[]> {
        try {
            // 获取所有交易对配置
            const allPairs = configManager.getTradingPairs()
            this.addLog(`🔍 配置的交易对总数: ${allPairs.length}`)

            // 获取所有涉及的代币（去重）
            const involvedTokens = new Set<string>()
            allPairs.forEach(pair => {
                involvedTokens.add(pair.from)
                involvedTokens.add(pair.to)
            })

            this.addLog(`🔍 涉及的代币: ${Array.from(involvedTokens).join(', ')}`)

            // 并行查询所有涉及代币的交易
            const promises: Promise<RawTransaction[]>[] = []

            for (const token of involvedTokens) {
                const tokenAddress = configManager.getTokenAddress(token)

                if (tokenAddress && tokenAddress !== 'native') {
                    promises.push(this.getTokenTransactionsByContract(blockRange, tokenAddress, token))
                } else if (tokenAddress === 'native') {
                    promises.push(this.getBNBTransactions(blockRange, token))
                } else {
                    this.addLog(`⚠️ ${token} 代币地址未配置，跳过查询`)
                    promises.push(Promise.resolve([]))
                }
            }

            const results = await Promise.all(promises)
            const tokenNames = Array.from(involvedTokens)

            // 输出每个代币的查询结果
            results.forEach((txs, index) => {
                this.addLog(`📊 ${tokenNames[index]}: ${txs.length}笔交易`)
            })

            // 合并所有交易
            const allTransactions = results.flat()
            this.addLog(`📋 总计获取: ${allTransactions.length}笔代币交易`)

            return allTransactions

        } catch (error) {
            this.addLog(`❌ 获取交易对交易失败: ${error}`)
            throw error
        }
    }

    /**
     * 获取指定代币合约的交易
     */
    private async getTokenTransactionsByContract(
        blockRange: BlockRange,
        contractAddress: string,
        tokenSymbol: string
    ): Promise<RawTransaction[]> {
        const allTransactions: RawTransaction[] = []
        let page = 1
        const pageSize = 10000

        while (true) {
            const params = {
                module: 'account',
                action: 'tokentx',
                contractaddress: contractAddress,
                address: this.walletAddress,
                startblock: blockRange.startBlock,
                endblock: blockRange.endBlock,
                page: page,
                offset: pageSize,
                sort: 'asc'
            }

            const response = await apiManager.makeRequest('bsc', 'bscscan', '', params)

            if (!response.success || !response.data) {
                throw new Error(`${tokenSymbol} API请求失败: ${response.error || '未知错误'}`)
            }

            // 处理BSCScan API的各种响应格式
            if (response.data.status === "0") {
                // status为0表示没有找到交易或出错
                if (response.data.message === "No transactions found" || 
                    (Array.isArray(response.data.result) && response.data.result.length === 0)) {
                    // 没有找到交易，正常结束
                    break
                } else {
                    // 其他错误
                    throw new Error(`${tokenSymbol} API请求失败: ${response.data.message || '未知错误'}`)
                }
            }

            if (!Array.isArray(response.data.result)) {
                throw new Error(`${tokenSymbol} API返回数据格式错误`)
            }

            const transactions = response.data.result as RawTransaction[]
            if (transactions.length === 0) {
                break
            }

            allTransactions.push(...transactions)

            if (transactions.length < pageSize) {
                break
            }

            page++
        }

        return allTransactions
    }

    /**
     * 获取BNB交易（原生代币）
     * 注意：BNB作为原生代币，实际上在DeFi交易中通常会被包装成WBNB进行交易
     * 这里返回空数组，因为纯BNB交易通常不是DeFi兑换交易
     */
    private async getBNBTransactions(blockRange: BlockRange, tokenSymbol: string): Promise<RawTransaction[]> {
        this.addLog(`⚠️ ${tokenSymbol} 是原生代币，跳过查询（DeFi交易通常使用WBNB）`)
        return []
    }

    /**
     * 分析交易组，判断是否为指定交易对的兑换
     */
    private async analyzeTransactionGroupForPair(hash: string, txGroup: RawTransaction[], fromToken: string, toToken: string): Promise<ExchangeTransaction | null> {
        let fromAmount = 0
        let toAmount = 0
        let fromTokenFound = ""
        let toTokenFound = ""
        let gasUsed = 0
        let gasPrice = 0
        let timestamp = 0
        let blockNumber = 0

        for (const tx of txGroup) {
            const symbol = this.normalizeTokenSymbol(tx.tokenSymbol)
            const decimals = parseInt(tx.tokenDecimal || "18")
            const value = parseFloat(ethers.formatUnits(tx.value || "0", decimals))

            if (isNaN(value) || value <= 0) continue

            // 获取gas信息
            if (tx.gasUsed && tx.gasPrice) {
                gasUsed = parseInt(tx.gasUsed)
                gasPrice = parseInt(tx.gasPrice)
            }
            timestamp = parseInt(tx.timeStamp)
            blockNumber = parseInt(tx.blockNumber)

            if (tx.from.toLowerCase() === this.walletAddress) {
                // 钱包发出的代币
                if (symbol === fromToken && value > fromAmount) {
                    fromAmount = value
                    fromTokenFound = symbol
                }
            } else if (tx.to.toLowerCase() === this.walletAddress) {
                // 钱包接收的代币
                if (symbol === toToken && value > toAmount) {
                    toAmount = value
                    toTokenFound = symbol
                }
            }
        }

        // 检查是否符合指定交易对
        if (fromTokenFound === fromToken && toTokenFound === toToken &&
            fromAmount > 0 && toAmount > 0) {

            const gasCost = gasUsed * gasPrice / 1e18 // 转换为BNB

            return {
                hash,
                blockNumber,
                timestamp,
                fromToken: fromTokenFound,
                toToken: toTokenFound,
                fromAmount,
                toAmount,
                gasUsed,
                gasPrice,
                gasCost
            }
        }

        return null
    }

    /**
     * 使用预计算价格映射表计算交易磨损
     */
    private async calculateTradingLossWithPriceMap(exchanges: ExchangeTransaction[], priceMap: { [symbol: string]: number }): Promise<TradingLossResult['tradingLoss']> {
        if (exchanges.length === 0) {
            return {
                totalSold: 0,
                totalBought: 0,
                lossAmount: 0,
                lossValue: 0,
                tokenSymbol: 'N/A'
            }
        }

        // 按代币分组计算磨损 - 直接统计实际数量，不进行价值换算
        const tokenStats = new Map<string, { sold: number, bought: number, price: number }>()
        
        for (const exchange of exchanges) {
            const fromTokenPrice = priceMap[exchange.fromToken] || 0
            const toTokenPrice = priceMap[exchange.toToken] || 0

            // 统计卖出的代币 (fromToken)
            if (!tokenStats.has(exchange.fromToken)) {
                tokenStats.set(exchange.fromToken, { sold: 0, bought: 0, price: fromTokenPrice })
            }
            tokenStats.get(exchange.fromToken)!.sold += exchange.fromAmount

            // 统计买入的代币 (toToken) - 直接使用实际收到的数量
            if (!tokenStats.has(exchange.toToken)) {
                tokenStats.set(exchange.toToken, { sold: 0, bought: 0, price: toTokenPrice })
            }
            tokenStats.get(exchange.toToken)!.bought += exchange.toAmount
        }

        // 计算总磨损（以USDT计价）
        let totalLossValue = 0
        let mainTokenSymbol = 'MIXED'

        this.addLog(`📉 交易磨损计算:`)
        for (const [token, stats] of tokenStats) {
            const lossAmount = stats.sold - stats.bought
            const lossValue = lossAmount * stats.price
            totalLossValue += lossValue
            
            // 控制精度到10位小数
            const precisionLossAmount = parseFloat(lossAmount.toFixed(10))
            const precisionLossValue = parseFloat(lossValue.toFixed(10))
            
            if (Math.abs(precisionLossAmount) > 0.0000000001) {
                this.addLog(`   ${token}: 卖出${stats.sold.toFixed(10)} - 买入${stats.bought.toFixed(10)} = ${precisionLossAmount.toFixed(10)} (价值$${precisionLossValue.toFixed(2)})`)
            }
        }

        this.addLog(`   总磨损价值: $${totalLossValue.toFixed(2)}`)

        return {
            totalSold: 0, // 混合代币无法简单相加
            totalBought: 0, // 混合代币无法简单相加
            lossAmount: 0, // 混合代币无法简单相加
            lossValue: totalLossValue,
            tokenSymbol: mainTokenSymbol
        }
    }

    /**
     * 计算Gas磨损
     */
    private async calculateGasLoss(exchanges: ExchangeTransaction[], priceMap?: { [symbol: string]: number }): Promise<TradingLossResult['gasLoss']> {
        const totalGasUsed = exchanges.reduce((sum, tx) => sum + tx.gasUsed, 0)
        const totalGasCost = exchanges.reduce((sum, tx) => sum + tx.gasCost, 0)

        // 优先使用传入的价格映射表中的BNB价格，避免重复API请求
        const bnbPrice = priceMap?.['BNB'] || await TokenPriceUtils.getCurrentBNBPrice()
        const totalGasValue = totalGasCost * bnbPrice

        this.addLog(`⛽ Gas磨损计算:`)
        this.addLog(`   总Gas消耗: ${totalGasUsed.toLocaleString()}`)
        this.addLog(`   总Gas费用: ${totalGasCost.toFixed(6)} BNB`)
        this.addLog(`   BNB价格: $${bnbPrice.toFixed(2)}`)
        this.addLog(`   Gas价值: $${totalGasValue.toFixed(2)}`)

        return {
            totalGasUsed,
            totalGasCost,
            totalGasValue,
            bnbPrice
        }
    }

    /**
     * 过滤有效交易（排除to为USDT等稳定币的交易）
     */
    private filterValidTransactions(exchanges: ExchangeTransaction[]): ExchangeTransaction[] {
        const stableCoins = configManager.getStableCoins()
        const validTransactions = exchanges.filter(tx =>
            !stableCoins.includes(tx.toToken)
        )

        this.addLog(`🎯 有效交易过滤:`)
        this.addLog(`   总兑换交易: ${exchanges.length}`)
        this.addLog(`   排除to为稳定币: ${exchanges.length - validTransactions.length}`)
        this.addLog(`   有效交易: ${validTransactions.length}`)

        return validTransactions
    }

    /**
     * 使用预计算价格映射表计算有效交易额
     */
    private async calculateValidVolumeWithPriceMap(validTransactions: ExchangeTransaction[], priceMap: { [symbol: string]: number }): Promise<number> {
        let totalVolume = 0

        this.addLog(`💰 计算有效交易量:`)
        
        for (const tx of validTransactions) {
            // 获取 fromToken 的价格
            const fromTokenPrice = priceMap[tx.fromToken] || 0
            // 交易量 = fromAmount × 价格
            const volume = tx.fromAmount * fromTokenPrice
            totalVolume += volume
            
            this.addLog(`   ${tx.fromToken}->${tx.toToken}: ${tx.fromAmount.toFixed(6)} ${tx.fromToken} × $${fromTokenPrice.toFixed(6)} = $${volume.toFixed(2)}`)
        }

        this.addLog(`📊 有效交易汇总:`)
        this.addLog(`   交易条数: ${validTransactions.length}`)
        this.addLog(`   总交易量: $${totalVolume.toFixed(2)}`)

        return totalVolume
    }

    /**
     * 获取代币价格
     */
    private async getTokenPrice(symbol: string, exchanges: ExchangeTransaction[]): Promise<number> {
        // 先检查是否为稳定币
        const tokenInfo = configManager.getTokenInfo(symbol)
        if (tokenInfo?.isStableCoin) {
            return tokenInfo.basePrice || 1
        }

        // 如果是BNB，获取实时价格
        if (symbol === 'BNB') {
            return await TokenPriceUtils.getCurrentBNBPrice()
        }

        // 通过交易链推算价格
        const transactions = exchanges.map(ex => ({
            fromToken: ex.fromToken,
            toToken: ex.toToken,
            fromAmount: ex.fromAmount,
            toAmount: ex.toAmount,
            timestamp: ex.timestamp,
            hash: ex.hash
        }))

        const priceMap = await TokenPriceUtils.buildCompletePriceMap(transactions)
        const price = priceMap[symbol] || 0

        if (price <= 0) {
            this.addLog(`⚠️ 无法获取 ${symbol} 价格，使用默认价格 0`)
            return 0
        }

        return price
    }

    /**
     * 标准化代币符号
     */
    private normalizeTokenSymbol(symbol: string): string {
        return configManager.normalizeTokenSymbol(symbol || "")
    }

    /**
     * 静态方法：分析指定日期的所有交易对
     */
    static async analyzeByDate(
        walletAddress: string,
        dateStr: string
    ): Promise<TradingPairAnalysisResult> {
        const blockRange = await TimeUtils.getBlockRangeByDate(dateStr, 0)
        const analyzer = new TradingPairAnalyzer(walletAddress)
        return await analyzer.analyzeInBlockRange(blockRange)
    }

    /**
     * 静态方法：分析指定区块范围的所有交易对
     */
    static async analyzeByBlockRange(
        walletAddress: string,
        blockRange: BlockRange
    ): Promise<TradingPairAnalysisResult> {
        const analyzer = new TradingPairAnalyzer(walletAddress)
        return await analyzer.analyzeInBlockRange(blockRange)
    }
}

