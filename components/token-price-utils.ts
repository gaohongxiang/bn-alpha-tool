export interface TokenPriceMap {
    [symbol: string]: number
}

export interface Transaction {
    fromToken?: string
    toToken?: string
    fromAmount?: number
    toAmount?: number
    timestamp: number
    hash: string
}

export class TokenPriceUtils {
    /**
     * 基础稳定币价格映射
     */
    private static readonly BASE_PRICES: TokenPriceMap = {
        'USDT': 1,
        'USDC': 1,
        'BUSD': 1,
        'DAI': 1
    }

    /**
     * 构建完整的代币价格映射表（包含BNB价格）
     * @param transactions 交易列表
     * @returns 代币价格映射表
     */
    static async buildCompletePriceMap(transactions: Transaction[]): Promise<TokenPriceMap> {
        // 首先构建基础价格映射表
        const priceMap = this.buildTokenPriceMap(transactions)
        
        // 添加BNB价格
        if (!priceMap['BNB']) {
            priceMap['BNB'] = await this.getCurrentBNBPrice()
        }

        return priceMap
    }

    /**
     * 基于交易链逐步推算代币价格
     * @param transactions 交易列表（需要按时间排序）
     * @returns 代币价格映射表
     */
    static buildTokenPriceMap(transactions: Transaction[]): TokenPriceMap {
        const priceMap: TokenPriceMap = { ...this.BASE_PRICES }

        console.log(`\n=== 代币价格推算开始 ===`)
        console.log(`📊 初始稳定币价格:`, priceMap)
        console.log(`🔗 分析 ${transactions.length} 笔交易`)

        // 按时间戳排序交易，确保按顺序推算价格
        const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp)

        let priceDiscoveryCount = 0

        for (let index = 0; index < sortedTxs.length; index++) {
            const tx = sortedTxs[index]
            const { fromToken, toToken, fromAmount, toAmount, timestamp, hash } = tx

            if (!fromToken || !toToken || !fromAmount || !toAmount || fromAmount <= 0 || toAmount <= 0) {
                continue
            }

            console.log(`\n🔍 分析交易 ${index + 1}: ${fromToken}→${toToken} (${this.formatTimestamp(timestamp)})`)
            console.log(`   数量: ${fromAmount.toFixed(4)} ${fromToken} → ${toAmount.toFixed(4)} ${toToken}`)
            console.log(`   哈希: ${hash.substring(0, 10)}...`)

            let discovered = false

            // 如果from代币价格已知，to代币价格未知，则推算to代币价格
            if (priceMap[fromToken] && priceMap[fromToken] > 0 && (!priceMap[toToken] || priceMap[toToken] === 0)) {
                const toTokenPrice = (fromAmount * priceMap[fromToken]) / toAmount
                priceMap[toToken] = toTokenPrice
                priceDiscoveryCount++
                discovered = true

                console.log(`   ✅ 发现 ${toToken} 价格: $${toTokenPrice.toFixed(6)}`)
                console.log(`      计算: ${fromAmount.toFixed(4)} × $${priceMap[fromToken].toFixed(6)} ÷ ${toAmount.toFixed(4)} = $${toTokenPrice.toFixed(6)}`)
            }
            // 如果to代币价格已知，from代币价格未知，则推算from代币价格
            else if (priceMap[toToken] && priceMap[toToken] > 0 && (!priceMap[fromToken] || priceMap[fromToken] === 0)) {
                const fromTokenPrice = (toAmount * priceMap[toToken]) / fromAmount
                priceMap[fromToken] = fromTokenPrice
                priceDiscoveryCount++
                discovered = true

                console.log(`   ✅ 发现 ${fromToken} 价格: $${fromTokenPrice.toFixed(6)}`)
                console.log(`      计算: ${toAmount.toFixed(4)} × $${priceMap[toToken].toFixed(6)} ÷ ${fromAmount.toFixed(4)} = $${fromTokenPrice.toFixed(6)}`)
            }
            // 如果两个代币价格都已知，验证价格一致性
            else if (priceMap[fromToken] && priceMap[toToken] && priceMap[fromToken] > 0 && priceMap[toToken] > 0) {
                const expectedToAmount = fromAmount * priceMap[fromToken] / priceMap[toToken]
                const priceDifferencePercent = Math.abs(expectedToAmount - toAmount) / toAmount * 100

                if (priceDifferencePercent > 5) { // 5%以上差异给出警告
                    console.log(`   ⚠️  价格验证警告: ${priceDifferencePercent.toFixed(2)}% 差异`)
                    console.log(`      预期: ${expectedToAmount.toFixed(4)} ${toToken}, 实际: ${toAmount.toFixed(4)} ${toToken}`)
                } else {
                    console.log(`   ✓ 价格验证通过: ${priceDifferencePercent.toFixed(2)}% 差异`)
                }
            }
            else {
                console.log(`   ⏭️  跳过: 两个代币价格均未知或均已知`)
            }

            // 如果发现了新价格，显示当前价格表状态
            if (discovered) {
                console.log(`   📊 当前价格表:`)
                Object.entries(priceMap)
                    .filter(([_, price]) => price > 0)
                    .forEach(([symbol, price]) => {
                        console.log(`      ${symbol}: $${price.toFixed(6)}`)
                    })
            }
        }

        console.log(`\n=== 价格推算完成 ===`)
        console.log(`🎯 发现 ${priceDiscoveryCount} 个新代币价格`)
        console.log(`📋 最终价格映射表:`)

        Object.entries(priceMap)
            .filter(([_, price]) => price > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([symbol, price]) => {
                const isStable = this.BASE_PRICES[symbol] ? '(稳定币)' : ''
                console.log(`   ${symbol}: $${price.toFixed(6)} ${isStable}`)
            })

        return priceMap
    }

    /**
     * 获取BNB的实时价格
     * @returns BNB/USDT价格
     */
    static async getCurrentBNBPrice(): Promise<number> {
        try {
            console.log('🔍 获取BNB实时价格...')
            
            // 使用BSCScan API获取BNB价格
            try {
                // 导入API管理器
                const { apiManager } = await import('../components/api-manager')
                
                const params = {
                    module: 'stats',
                    action: 'bnbprice'
                }
                
                const response = await apiManager.makeRequest('bsc', 'bscscan', '', params)
                
                if (response.success && response.data?.result) {
                    const bnbPrice = parseFloat(response.data.result.ethusd)
                    if (bnbPrice && bnbPrice > 0) {
                        console.log(`✅ BSCScan BNB价格: $${bnbPrice}`)
                        return bnbPrice
                    }
                }
            } catch (error) {
                console.log('⚠️ BSCScan API失败:', error)
            }

            // 备用方法1：Binance API
            try {
                const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
                const data = await response.json()
                const price = parseFloat(data.price)
                if (price && price > 0) {
                    console.log(`✅ Binance BNB价格: $${price}`)
                    return price
                }
            } catch (error) {
                console.log('⚠️ Binance API失败:', error)
            }

            // 备用方法2：CoinGecko API
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd')
                const data = await response.json()
                const price = data.binancecoin?.usd
                if (price && price > 0) {
                    console.log(`✅ CoinGecko BNB价格: $${price}`)
                    return price
                }
            } catch (error) {
                console.log('⚠️ CoinGecko API失败:', error)
            }

            console.log('⚠️ 所有BNB价格API都失败，使用默认价格')
            return 600 // 默认价格
            
        } catch (error) {
            console.error('❌ BNB价格获取失败:', error)
            return 600 // 默认价格
        }
    }

    /**
     * 获取指定代币在指定时间的价格
     * @param symbol 代币符号
     * @param timestamp 时间戳
     * @param priceMap 价格映射表
     * @returns 代币价格
     */
    static getTokenPrice(symbol: string, timestamp: number, priceMap: TokenPriceMap): number {
        // 稳定币直接返回1
        if (this.BASE_PRICES[symbol]) {
            return this.BASE_PRICES[symbol]
        }

        // 从价格映射表获取
        const price = priceMap[symbol] || 0
        if (price > 0) {
            return price
        }

        // 对于BNB，提示应该使用getCurrentBNBPrice()
        if (symbol === 'BNB') {
            console.warn(`⚠️ BNB价格应使用 getCurrentBNBPrice() 获取实时价格，当前返回备用价格`)
            return 600 // 备用价格
        }

        console.warn(`⚠️ 无法获取 ${symbol} 的价格`)
        return 0
    }

    /**
     * 计算代币组合的总价值
     * @param balances 代币余额映射
     * @param priceMap 价格映射表
     * @param timestamp 计算时间戳（用于日志）
     * @returns 总价值
     */
    static calculateTotalValue(
        balances: { [symbol: string]: number },
        priceMap: TokenPriceMap,
        timestamp?: number
    ): number {
        let totalValue = 0
        const timeStr = timestamp ? this.formatTimestamp(timestamp) : '当前'

        console.log(`\n💰 计算 ${timeStr} 代币总价值:`)

        Object.entries(balances).forEach(([symbol, balance]) => {
            if (balance > 0) {
                const price = this.getTokenPrice(symbol, timestamp || 0, priceMap)
                const value = balance * price
                totalValue += value

                console.log(`   ${symbol}: ${balance.toFixed(6)} × $${price.toFixed(6)} = $${value.toFixed(2)}`)
            }
        })

        console.log(`   💎 总价值: $${totalValue.toFixed(2)}`)
        return totalValue
    }

    /**
     * 格式化时间戳
     */
    private static formatTimestamp(timestamp: number): string {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai'
        })
    }

    /**
     * 验证价格映射表的完整性
     * @param priceMap 价格映射表
     * @param requiredTokens 需要的代币列表
     * @returns 是否完整
     */
    static validatePriceMap(priceMap: TokenPriceMap, requiredTokens: string[]): boolean {
        const missingTokens = requiredTokens.filter(token =>
            !priceMap[token] || priceMap[token] <= 0
        )

        if (missingTokens.length > 0) {
            console.warn(`⚠️ 价格映射表缺少代币:`, missingTokens)
            return false
        }

        return true
    }
} 