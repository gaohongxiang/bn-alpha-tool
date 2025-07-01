import type { 
  RawTransaction, 
  ExchangeTransaction, 
  TradingPairAnalysisResult,
  BlockRange,
  TradingLossResult 
} from '@/types'
import { ethers } from "ethers"
import { BSCScanService } from '../api/bscscan-service'
import { TokenPriceUtils } from '../../lib/utils/token-price-utils'
import { configManager } from '../../lib/config-manager'
import { DebugLogger } from '../../lib/debug-logger'

/**
 * 交易分析服务
 * 按指定交易对分析交易磨损和有效交易
 */
export class TransactionAnalysisService {
  private static instance: TransactionAnalysisService
  private bscscanService: BSCScanService
  private logs: string[] = []

  private constructor() {
    this.bscscanService = BSCScanService.getInstance()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): TransactionAnalysisService {
    if (!TransactionAnalysisService.instance) {
      TransactionAnalysisService.instance = new TransactionAnalysisService()
    }
    return TransactionAnalysisService.instance
  }

  /**
   * 分析指定区块范围内的所有交易对交易
   * @param walletAddress 钱包地址
   * @param blockRange 区块范围
   * @param sharedPriceMap 可选的共享价格映射表，用于避免重复构建
   */
  async analyzeInBlockRange(
    walletAddress: string, 
    blockRange: BlockRange,
    sharedPriceMap?: { [symbol: string]: number }
  ): Promise<TradingPairAnalysisResult> {
    this.logs = []
    const address = walletAddress.toLowerCase()
    
    this.addLog(`🔍 开始分析钱包所有交易对`)
    this.addLog(`📊 钱包地址: ${address}`)
    this.addLog(`🎯 区块范围: ${blockRange.startBlock} - ${blockRange.endBlock}`)

    try {
      // 1. 获取所有交易对的代币交易 (使用优化策略)
      const allTransactions = await this.getAllTradingPairTransactionsOptimized(address, blockRange)
      this.addLog(`📋 获取到 ${allTransactions.length} 笔相关代币交易`)

      // 2. 筛选所有交易对的兑换交易
      const exchangeTransactions = await this.filterExchangeTransactions(allTransactions, address)
      this.addLog(`💱 筛选出 ${exchangeTransactions.length} 笔兑换交易`)

      // 3. 过滤有效交易 (纯逻辑筛选，无需价格)
      const validTransactions = this.filterValidTransactions(exchangeTransactions)
      this.addLog(`📝 筛选出 ${validTransactions.length} 笔有效交易`)

      // 4. 使用共享价格映射表或构建新的
      let priceMap: { [symbol: string]: number }
      if (sharedPriceMap && Object.keys(sharedPriceMap).length > 0) {
        priceMap = sharedPriceMap
        this.addLog(`💰 使用共享价格映射表，包含 ${Object.keys(priceMap).length} 个代币价格`)
      } else {
        // 回退到构建新的价格映射表
        const transactions = exchangeTransactions.map(ex => ({
          fromToken: ex.fromToken,
          toToken: ex.toToken,
          fromAmount: ex.fromAmount,
          toAmount: ex.toAmount,
          timestamp: ex.timestamp,
          hash: ex.hash
        }))
        priceMap = await TokenPriceUtils.buildCompletePriceMap(transactions)
        this.addLog(`💰 构建新的价格映射表，包含 ${Object.keys(priceMap).length} 个代币价格`)
      }

      // 5. 并行计算所有指标 (性能优化)
      this.addLog(`🚀 开始并行计算: 交易磨损、Gas费用、有效交易量`)
      
      // 5.1 并行执行独立计算
      const [tradingLoss, gasLoss, validVolume] = await Promise.all([
        // 交易磨损计算 (依赖priceMap，基于所有符合条件交易)
        this.calculateTradingLossWithPriceMap(exchangeTransactions, priceMap),
        
        // Gas费用计算 (依赖priceMap中的BNB价格，基于所有符合条件交易)
        this.calculateGasLoss(exchangeTransactions, priceMap),
        
        // 有效交易量计算 (依赖priceMap，基于有效交易列表)
        this.calculateValidVolumeWithPriceMap(validTransactions, priceMap)
      ])

      this.addLog(`✅ 并行计算完成: 有效交易 ${validTransactions.length} 笔，总额 $${validVolume.toFixed(2)}`)
      this.addLog(`📊 流程优化: 有效交易提前筛选，3个计算任务真正并行，无依赖关系`)

      const result: TradingLossResult = {
        tradingLoss,
        gasLoss,
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
        walletAddress: address,
        result,
        logs: [...this.logs]
      }

    } catch (error) {
      this.addLog(`❌ 分析过程中出现错误: ${error}`)
      throw error
    }
  }

  private addLog(message: string): void {
    DebugLogger.log(message)
    this.logs.push(message)
  }

  /**
   * 获取所有交易对在指定区块范围内的交易
   */
  private async getAllTradingPairTransactions(address: string, blockRange: BlockRange): Promise<RawTransaction[]> {
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

      // 并行查询涉及代币的交易
      const tokenNames = Array.from(involvedTokens)
      const promises = tokenNames.map(async (token) => {
        const tokenAddress = configManager.getTokenAddress(token)

        if (tokenAddress && tokenAddress !== 'native') {
          return await this.getTokenTransactionsByContract(address, blockRange, tokenAddress, token)
        } else if (tokenAddress === 'native') {
          return await this.getBNBTransactions(blockRange, token)
        } else {
          this.addLog(`⚠️ ${token} 代币地址未配置，跳过查询`)
          return []
        }
      })

      this.addLog(`🚀 并行查询 ${promises.length} 个代币的交易数据`)
      const results = await Promise.allSettled(promises)

      // 处理查询结果
      const allTransactions: RawTransaction[] = []
      results.forEach((result, index) => {
        const token = tokenNames[index]
        if (result.status === 'fulfilled') {
          const transactions = result.value
          allTransactions.push(...transactions)
          this.addLog(`📊 ${token}: ${transactions.length}笔交易`)
        } else {
          this.addLog(`❌ ${token} 查询失败: ${result.reason}`)
        }
      })

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
    address: string,
    blockRange: BlockRange,
    contractAddress: string,
    tokenSymbol: string
  ): Promise<RawTransaction[]> {
    const allTransactions: RawTransaction[] = []
    let page = 1
    const pageSize = 10000

    while (true) {
      const response = await this.bscscanService.getTokenTransactions(
        contractAddress,
        address,
        blockRange.startBlock,
        blockRange.endBlock,
        page,
        pageSize
      )

      if (!response.success || !response.data) {
        throw new Error(`${tokenSymbol} API请求失败: ${response.error || '未知错误'}`)
      }

      // 处理BSCScan API的各种响应格式
      if (response.data.status === "0") {
        if (response.data.message === "No transactions found" || 
            (Array.isArray(response.data.result) && response.data.result.length === 0)) {
          break
        } else {
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
   */
  private async getBNBTransactions(blockRange: BlockRange, tokenSymbol: string): Promise<RawTransaction[]> {
    this.addLog(`⚠️ ${tokenSymbol} 是原生代币，跳过查询（DeFi交易通常使用WBNB）`)
    return []
  }

    /**
   * 筛选符合配置交易对的所有交易
   */
  private async filterExchangeTransactions(allTransactions: RawTransaction[], address: string): Promise<ExchangeTransaction[]> {
    const exchanges: ExchangeTransaction[] = []
    
    this.addLog(`📋 开始筛选符合配置交易对的交易，共 ${allTransactions.length} 笔原始交易`)
    
    // 获取配置的所有交易对
    const tradingPairs = configManager.getTradingPairs()
    this.addLog(`📊 配置的交易对: ${tradingPairs.map(p => `${p.from}-${p.to}`).join(', ')}`)
    
    // 按交易哈希分组所有转账记录
    const transactionsByHash: { [hash: string]: RawTransaction[] } = {}
    for (const tx of allTransactions) {
      if (!transactionsByHash[tx.hash]) {
        transactionsByHash[tx.hash] = []
      }
      transactionsByHash[tx.hash].push(tx)
    }
    
    this.addLog(`📊 发现 ${Object.keys(transactionsByHash).length} 个唯一交易`)
    
    // 处理每个交易，识别符合配置的交易对
    for (const [hash, txList] of Object.entries(transactionsByHash)) {
      try {
        this.addLog(`🔍 处理交易: ${hash.substring(0,10)}... (${txList.length}个转账记录)`)
        
        // 分析转账记录，识别交易对
        const userIncomingTokens = new Map<string, number>()  // 用户接收的代币
        const userOutgoingTokens = new Map<string, number>()  // 用户发出的代币
        
        let gasUsed = 0
        let gasPrice = 0
        let blockNumber = 0
        let timestamp = 0
        
        this.addLog(`📋 分析转账记录:`)
        for (const tx of txList) {
          const rawTokenSymbol = tx.tokenSymbol
          if (!rawTokenSymbol) {
            this.addLog(`⚠️ 跳过无代币符号的转账`)
            continue
          }
          
          // 解析代币别名，获取标准符号
          const tokenSymbol = configManager.normalizeTokenSymbol(rawTokenSymbol)
          if (rawTokenSymbol !== tokenSymbol) {
            this.addLog(`🔄 代币别名映射: ${rawTokenSymbol} → ${tokenSymbol}`)
          }
          
          const amount = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || '18'))
          const isIncoming = tx.to.toLowerCase() === address.toLowerCase()
          
          // 记录交易基本信息
          gasUsed = Math.max(gasUsed, parseFloat(tx.gasUsed || '0'))
          gasPrice = Math.max(gasPrice, parseFloat(tx.gasPrice || '0'))
          blockNumber = parseInt(tx.blockNumber)
          timestamp = parseInt(tx.timeStamp)
          
          if (isIncoming) {
            userIncomingTokens.set(tokenSymbol, (userIncomingTokens.get(tokenSymbol) || 0) + amount)
            this.addLog(`📥 接收: ${amount.toFixed(4)} ${tokenSymbol} (原始: ${rawTokenSymbol})`)
          } else {
            userOutgoingTokens.set(tokenSymbol, (userOutgoingTokens.get(tokenSymbol) || 0) + amount)
            this.addLog(`📤 发出: ${amount.toFixed(4)} ${tokenSymbol} (原始: ${rawTokenSymbol})`)
          }
        }
        
        this.addLog(`📊 转账汇总:`)
        this.addLog(`   接收代币: ${Array.from(userIncomingTokens.entries()).map(([token, amount]) => `${amount.toFixed(4)} ${token}`).join(', ')}`)
        this.addLog(`   发出代币: ${Array.from(userOutgoingTokens.entries()).map(([token, amount]) => `${amount.toFixed(4)} ${token}`).join(', ')}`)
        
        // 检查是否匹配配置的交易对
        this.addLog(`🔍 检查交易对匹配:`)
        let foundMatch = false
        for (const pair of tradingPairs) {
          const fromToken = pair.from
          const toToken = pair.to
          
          // 检查是否有对应的转账：发出fromToken，接收toToken
          const outgoingAmount = userOutgoingTokens.get(fromToken) || 0
          const incomingAmount = userIncomingTokens.get(toToken) || 0
          
          this.addLog(`   检查 ${fromToken}→${toToken}: 发出${outgoingAmount.toFixed(4)}${fromToken}, 接收${incomingAmount.toFixed(4)}${toToken}`)
          
          if (outgoingAmount > 0 && incomingAmount > 0) {
            // 找到匹配的交易对
            exchanges.push({
              hash,
              blockNumber,
              timestamp,
              fromToken,
              toToken,
              fromAmount: outgoingAmount,  // 真实发出的数量
              toAmount: incomingAmount,    // 真实接收的数量
              gasUsed,
              gasPrice,
              gasCost: gasUsed * gasPrice / Math.pow(10, 18)
            })
            
            this.addLog(`✅ 匹配成功: ${fromToken}→${toToken}, 发出${outgoingAmount.toFixed(4)} ${fromToken}, 接收${incomingAmount.toFixed(4)} ${toToken}`)
            foundMatch = true
          }
        }
        
        if (!foundMatch) {
          this.addLog(`❌ 未找到匹配的交易对`)
        }
        
      } catch (error) {
        this.addLog(`⚠️ 处理交易失败: ${hash} - ${error}`)
      }
    }

    this.addLog(`💱 筛选完成: 找到 ${exchanges.length} 笔符合配置的交易对交易`)
    return exchanges
  }

  private async calculateTradingLossWithPriceMap(exchanges: ExchangeTransaction[], priceMap: { [symbol: string]: number }) {
    this.addLog(`💸 开始计算交易磨损，共 ${exchanges.length} 笔交易`)
    this.addLog(`📊 按照公式: 磨损 = 总卖出价值 - 总买入价值`)
    
    let totalSoldValue = 0    // 总卖出价值（所有卖出代币的USD价值）
    let totalBoughtValue = 0  // 总买入价值（所有买入代币的USD价值）
    
    // 统计每种代币的卖出和买入数量
    const soldTokens: { [token: string]: number } = {}
    const boughtTokens: { [token: string]: number } = {}

    // 遍历每笔交易，累计卖出和买入的代币数量
    for (const ex of exchanges) {
      const fromToken = ex.fromToken
      const toToken = ex.toToken
      const fromAmount = ex.fromAmount
      const toAmount = ex.toAmount
      
      // 卖出的代币
      soldTokens[fromToken] = (soldTokens[fromToken] || 0) + fromAmount
      
      // 买入的代币  
      boughtTokens[toToken] = (boughtTokens[toToken] || 0) + toAmount
      
      this.addLog(`📝 交易: ${ex.hash.substring(0,8)}... 卖出${fromAmount.toFixed(4)} ${fromToken}, 买入${toAmount.toFixed(4)} ${toToken}`)
    }

    this.addLog(`\n📊 代币统计汇总:`)
    
    // 计算总卖出价值
    this.addLog(`📤 卖出代币计算:`)
    for (const [token, amount] of Object.entries(soldTokens)) {
      const price = priceMap[token] || 0
      const value = amount * price
      totalSoldValue += value
      
      if (price > 0) {
        this.addLog(`   ${token}: ${amount.toFixed(4)} × $${price.toFixed(6)} = $${value.toFixed(2)}`)
      } else {
        this.addLog(`   ${token}: ${amount.toFixed(4)} × $0 = $0 ⚠️无价格数据`)
      }
    }

    // 计算总买入价值
    this.addLog(`📥 买入代币计算:`)
    for (const [token, amount] of Object.entries(boughtTokens)) {
      const price = priceMap[token] || 0
      const value = amount * price
      totalBoughtValue += value
      
      if (price > 0) {
        this.addLog(`   ${token}: ${amount.toFixed(4)} × $${price.toFixed(6)} = $${value.toFixed(2)}`)
      } else {
        this.addLog(`   ${token}: ${amount.toFixed(4)} × $0 = $0 ⚠️无价格数据`)
      }
    }

    const tradingLoss = totalSoldValue - totalBoughtValue
    
    this.addLog(`\n💰 交易磨损统计:`)
    this.addLog(`   总卖出价值: $${totalSoldValue.toFixed(2)}`)
    this.addLog(`   总买入价值: $${totalBoughtValue.toFixed(2)}`)
    this.addLog(`   交易磨损: $${tradingLoss.toFixed(2)} (卖出价值 - 买入价值)`)
    
    if (tradingLoss > 0) {
      this.addLog(`   📈 结果: 发生磨损 $${tradingLoss.toFixed(2)}`)
    } else {
      this.addLog(`   📉 结果: 获得收益 $${Math.abs(tradingLoss).toFixed(2)}`)
    }

    return {
      totalSold: totalSoldValue,      // 总卖出价值
      totalBought: totalBoughtValue,  // 总买入价值  
      lossAmount: Math.max(0, tradingLoss),
      lossValue: tradingLoss, // 保留负值，表示收益
      tokenSymbol: 'USD'
    }
  }

  private async calculateGasLoss(exchanges: ExchangeTransaction[], priceMap?: { [symbol: string]: number }) {
    const bnbPrice = priceMap?.['BNB'] || 600
    let totalGasUsedBNB = 0
    let transactionCount = 0
    
    this.addLog(`⛽ 开始计算Gas费，共 ${exchanges.length} 笔交易，BNB价格: $${bnbPrice}`)
    
    for (const ex of exchanges) {
      const gasUsedBNB = ex.gasUsed * ex.gasPrice / Math.pow(10, 18) // 转换为BNB
      totalGasUsedBNB += gasUsedBNB
      transactionCount++
      
      this.addLog(`⛽ Gas费: ${ex.hash.substring(0,8)}... Gas=${ex.gasUsed} Price=${ex.gasPrice} 费用=${gasUsedBNB.toFixed(6)}BNB ($${(gasUsedBNB * bnbPrice).toFixed(2)})`)
    }

    const totalGasValueUSD = totalGasUsedBNB * bnbPrice
    
    this.addLog(`⛽ Gas费统计: 总消耗${totalGasUsedBNB.toFixed(6)}BNB, 总价值$${totalGasValueUSD.toFixed(2)} (${transactionCount}笔交易)`)

    return {
      totalGasUsed: transactionCount,
      totalGasCost: totalGasUsedBNB,
      totalGasValue: totalGasValueUSD,
      bnbPrice
    }
  }

  private filterValidTransactions(exchanges: ExchangeTransaction[]): ExchangeTransaction[] {
    this.addLog(`📝 筛选有效交易：在所有符合配置的交易中，找出买入ERC代币的交易`)
    
    const validTransactions = exchanges.filter(ex => {
      const pairKey = `${ex.fromToken}-${ex.toToken}`
      
      // 有效交易规则：买入ERC代币的交易（toToken不是稳定币）
      const shouldCount = configManager.shouldCountForVolume(ex.fromToken, ex.toToken)
      
      if (shouldCount) {
        this.addLog(`✅ 有效交易: ${ex.hash.substring(0,10)}... ${pairKey}, 买入${ex.toAmount.toFixed(4)} ${ex.toToken}`)
      } else {
        this.addLog(`⚠️ 非有效交易: ${ex.hash.substring(0,10)}... ${pairKey}, 卖出换稳定币`)
      }
      
      return shouldCount
    })
    
    this.addLog(`🎯 有效交易筛选结果: ${validTransactions.length}/${exchanges.length} 笔交易`)
    this.addLog(`📋 有效交易定义: 买入ERC代币的交易（toToken不是USDT等稳定币）`)
    return validTransactions
  }

  private async calculateValidVolumeWithPriceMap(validTransactions: ExchangeTransaction[], priceMap: { [symbol: string]: number }): Promise<number> {
    let totalVolume = 0
    
    this.addLog(`📊 计算有效交易量，共 ${validTransactions.length} 笔有效交易`)
    
    for (const tx of validTransactions) {
      let txVolume = 0
      
      if (tx.fromToken === 'USDT') {
        // USDT买入代币：直接使用花费的USDT数量
        txVolume = tx.fromAmount
        this.addLog(`💰 交易量: ${tx.hash.substring(0,8)}... 花费${tx.fromAmount.toFixed(2)} USDT 买入${tx.toAmount.toFixed(4)} ${tx.toToken}`)
        
      } else {
        // 其他代币买入代币：按from代币价格计算
        const fromPrice = priceMap[tx.fromToken] || 1
        txVolume = tx.fromAmount * fromPrice
        this.addLog(`💰 交易量: ${tx.hash.substring(0,8)}... ${tx.fromAmount.toFixed(4)} ${tx.fromToken} × $${fromPrice.toFixed(6)} = $${txVolume.toFixed(2)}`)
      }
      
      totalVolume += txVolume
    }
    
    this.addLog(`💰 有效交易量合计: $${totalVolume.toFixed(2)} (${validTransactions.length}笔有效交易)`)
    
    return totalVolume
  }

  /**
   * 获取所有交易对在指定区块范围内的交易 (优化版：单次查询+过滤)
   */
  private async getAllTradingPairTransactionsOptimized(address: string, blockRange: BlockRange): Promise<RawTransaction[]> {
    try {
      this.addLog(`🚀 使用优化策略：区块范围内所有代币交易 + 客户端过滤`)
      
      // 单次API调用获取区块范围内所有代币交易  
      const allTokenTxResponse = await this.bscscanService.makeRequest({
        module: 'account',
        action: 'tokentx',
        address: address,
        startblock: blockRange.startBlock,
        endblock: blockRange.endBlock,
        page: 1,
        offset: 10000,
        sort: 'asc'
      })

      if (!allTokenTxResponse.success || !allTokenTxResponse.data?.result) {
        throw new Error(`获取代币交易失败: ${allTokenTxResponse.error}`)
      }

      const allTokenTxs = Array.isArray(allTokenTxResponse.data.result) ? allTokenTxResponse.data.result : []
      this.addLog(`📋 获取到 ${allTokenTxs.length} 笔代币交易`)

      // 客户端过滤：只保留配置代币的交易
      const configuredTokens = new Set(configManager.getTradingPairs().flatMap(p => [p.from, p.to]))
      const filteredTokenTxs = allTokenTxs.filter((tx: any) => {
        const tokenSymbol = configManager.normalizeTokenSymbol(tx.tokenSymbol || '')
        return configuredTokens.has(tokenSymbol)
      })

      this.addLog(`🔍 过滤后保留 ${filteredTokenTxs.length} 笔相关代币交易`)
      this.addLog(`📊 API调用优化: 1次调用 vs ${configuredTokens.size}次调用 (传统方式)`)

      return filteredTokenTxs as RawTransaction[]

    } catch (error) {
      this.addLog(`❌ 优化查询失败，回退到传统方式: ${error}`)
      // 回退到原来的方式
      return await this.getAllTradingPairTransactions(address, blockRange)
    }
  }
} 