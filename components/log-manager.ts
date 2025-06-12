/**
 * 统一日志管理器
 * 整合各个组件的关键打印信息，提供结构化的日志输出
 * 支持控制台输出和文件保存
 */
export class LogManager {
  private static logs: string[] = []
  private static currentSession: string = ''
  private static isClient: boolean = false
  private static originalConsoleLog: any = null
  
  /**
   * 初始化日志管理器
   */
  static initialize() {
    this.isClient = typeof window !== 'undefined'
    
    // 拦截console.log来自动记录日志
    if (this.isClient && !this.originalConsoleLog) {
      this.originalConsoleLog = console.log
      console.log = (...args: any[]) => {
        // 调用原始的console.log
        this.originalConsoleLog.apply(console, args)
        
        // 同时记录到我们的日志系统
        if (this.currentSession) {
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ')
          
          // 只记录非LogManager自身产生的日志
          if (!message.includes('========== ') && !message.startsWith('[')) {
            const timestamp = new Date().toLocaleTimeString('zh-CN')
            this.logs.push(`[${timestamp}] 控制台: ${message}`)
          }
        }
      }
    }
  }
  
  /**
   * 恢复原始console.log
   */
  static restoreConsole() {
    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog
      this.originalConsoleLog = null
    }
  }

  /**
   * 安全的console输出方法
   */
  private static safeLog(...args: any[]) {
    const outputMethod = this.originalConsoleLog || console.log
    outputMethod.apply(console, args)
  }
  
  /**
   * 生成日志文件名
   */
  private static generateLogFileName(): string {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-') // HH-MM-SS
    return `wallet-analysis-${dateStr}_${timeStr}.log`
  }
  
  /**
   * 保存日志到文件
   */
  private static async saveToFile() {
    if (!this.isClient || this.logs.length === 0) return
    
    try {
      const logContent = this.logs.join('\n') + '\n'
      const fileName = this.generateLogFileName()
      
      // 创建Blob对象
      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' })
      
      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      
      // 触发下载
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 清理URL对象
      URL.revokeObjectURL(url)
      
      this.safeLog(`📁 日志已保存到文件: ${fileName}`)
    } catch (error) {
      console.error('❌ 保存日志文件失败:', error)
    }
  }
  
  /**
   * 开始新的查询会话
   */
  static startSession(sessionId: string) {
    this.initialize()
    this.currentSession = sessionId
    this.logs = []
    
    const startLog = `🚀 ========== 开始新查询会话: ${sessionId} ==========`
    this.logs.push(startLog)
    
    // 使用原始console.log输出，避免重复记录
    this.safeLog(`\n${startLog}`)
  }
  
  /**
   * 结束当前会话
   */
  static async endSession() {
    const endLog = `✅ ========== 会话结束: ${this.currentSession} ==========`
    this.logs.push(endLog)
    
    // 使用原始console.log输出，避免重复记录
    this.safeLog(`\n${endLog}\n`)
    
    // 会话结束时自动保存日志文件
    try {
      await this.saveToServer()
    } catch (error) {
      this.safeLog('⚠️ 自动保存到服务器失败，会话结束时仅保存到浏览器')
    }
    
    this.currentSession = ''
  }
  
  /**
   * 添加日志
   */
  static addLog(category: string, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString('zh-CN')
    const logMessage = `[${timestamp}] ${category}: ${message}`
    this.logs.push(logMessage)
    
    // 使用原始console.log输出，避免重复记录
    const outputMethod = this.originalConsoleLog || console.log
    
    if (data) {
      outputMethod(logMessage, data)
      // 将数据对象转换为字符串并添加到日志
      this.logs.push(JSON.stringify(data, null, 2))
    } else {
      outputMethod(logMessage)
    }
  }
  
  /**
   * 输出配置信息摘要
   */
  static logConfigSummary(stats: any) {
    const summaryLines = [
      '📋 ========== 配置摘要 ==========',
      `🌐 当前网络: ${stats.currentNetwork}`,
      `🪙 代币数量: ${stats.totalTokens}`,
      `🔄 交易对数量: ${stats.totalPairs}`,
      `📊 计量交易对: ${stats.volumeCountingPairs}`,
      `🔑 API Key数量: ${stats.totalAPIKeys}`
    ]
    
    summaryLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出API状态摘要
   */
  static logAPIStatus(apiStats: any) {
    const statusLines = [
      '📊 ========== API状态 ==========',
      `🔑 总API Key数: ${apiStats.totalKeys}`,
      `✅ 活跃API Key数: ${apiStats.activeKeys}`,
      `💚 健康API Key数: ${apiStats.healthyKeys}`,
      `⚡ 理论最大RPS: ${apiStats.requestsPerSecond}/秒`,
      `🌐 当前网络: ${apiStats.currentNetwork}`
    ]
    
    statusLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出钱包查询开始信息
   */
  static logWalletQueryStart(walletCount: number, selectedDate: string) {
    const startLines = [
      '🎯 ========== 开始钱包分析 ==========',
      `📅 查询日期: ${selectedDate}`,
      `💼 钱包数量: ${walletCount}`,
      `⏰ 时间范围: 每日8:00-次日7:59 (UTC+8)`
    ]
    
    startLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出单个钱包分析结果
   */
  static logWalletResult(index: number, total: number, wallet: any, result: any) {
    const resultLines = [
      `📊 ========== 钱包 ${index + 1}/${total} 分析完成 ==========`,
      `🏠 地址: ${wallet.address}`,
      `📝 备注: ${wallet.note}`,
      `💰 余额: $${result.tokenBalances?.reduce((sum: number, token: any) => sum + token.usdValue, 0).toFixed(2) || '0'}`,
      `📈 交易量: $${result.tradingVolume?.toFixed(2) || '0'}`,
      `🔢 交易次数: ${result.transactionCount || 0}`,
      `📉 交易磨损: $${result.tradingLoss?.toFixed(2) || '0'}`,
      `⛽ Gas费: $${result.gasLoss?.toFixed(2) || '0'}`,
      `🏆 预估积分: ${result.estimatedPoints || 0}分`
    ]
    
    if (result.error) {
      resultLines.push(`❌ 错误: ${result.error}`)
    }
    
    resultLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出批量查询总结
   */
  static logBatchSummary(results: any[]) {
    const successfulQueries = results.filter(r => !r.error).length
    const failedQueries = results.filter(r => r.error).length
    const totalVolume = results.reduce((sum, r) => sum + (r.tradingVolume || 0), 0)
    const totalTradingLoss = results.reduce((sum, r) => sum + (r.tradingLoss || 0), 0)
    const totalGasLoss = results.reduce((sum, r) => sum + (r.gasLoss || 0), 0)
    const totalTransactions = results.reduce((sum, r) => sum + (r.transactionCount || 0), 0)
    const totalPoints = results.reduce((sum, r) => sum + (r.estimatedPoints || 0), 0)
    const totalBalance = results.reduce((sum, r) => {
      return sum + (r.tokenBalances?.reduce((tokenSum: number, token: any) => tokenSum + token.usdValue, 0) || 0)
    }, 0)
    
    const summaryLines = [
      '🎉 ========== 批量查询总结 ==========',
      '📊 查询统计:',
      `   ✅ 成功: ${successfulQueries}个钱包`,
      `   ❌ 失败: ${failedQueries}个钱包`,
      `   📈 成功率: ${((successfulQueries / results.length) * 100).toFixed(1)}%`,
      '',
      '💎 资产统计:',
      `   💰 总余额: $${totalBalance.toFixed(2)}`,
      `   📈 总交易量: $${totalVolume.toFixed(2)}`,
      `   🔢 总交易次数: ${totalTransactions}`,
      '',
      '💸 磨损统计:',
      `   📉 总交易磨损: $${totalTradingLoss.toFixed(2)}`,
      `   ⛽ 总Gas费: $${totalGasLoss.toFixed(2)}`,
      `   💸 总磨损: $${(totalTradingLoss + totalGasLoss).toFixed(2)}`,
      '',
      '🏆 积分统计:',
      `   🎯 总预估积分: ${totalPoints}分`,
      `   📊 平均积分: ${(totalPoints / Math.max(successfulQueries, 1)).toFixed(1)}分/钱包`
    ]
    
    if (failedQueries > 0) {
      summaryLines.push('', '⚠️  失败钱包详情:')
      results.filter(r => r.error).forEach((r, index) => {
        summaryLines.push(`   ${index + 1}. ${r.address}: ${r.error}`)
      })
    }
    
    summaryLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出价格信息
   */
  static logPriceInfo(priceMap: { [symbol: string]: number }) {
    const priceLines = ['💱 ========== 代币价格信息 ==========']
    
    Object.entries(priceMap)
      .filter(([_, price]) => price > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([symbol, price]) => {
        priceLines.push(`   ${symbol}: $${price.toFixed(6)}`)
      })
      
    priceLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出时间分析信息
   */
  static logTimeAnalysis(selectedDate: string, timeInfo: any) {
    const timeLines = [
      '⏰ ========== 时间分析 ==========',
      `📅 查询日期: ${selectedDate}`,
      `🕐 开始时间: ${timeInfo.startTime}`,
      `🕐 结束时间: ${timeInfo.endTime}`,
      `✅ 状态: ${timeInfo.isCompleted ? '已完成' : '进行中'}`
    ]
    
    timeLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出缓存状态
   */
  static logCacheStatus(cacheStats: any) {
    const cacheLines = [
      '💾 ========== 缓存状态 ==========',
      `📦 区块缓存: ${cacheStats.blockCacheSize}个`,
      `💰 代币价格缓存: ${cacheStats.tokenPriceSize}个`,
      `📅 日价格缓存: ${cacheStats.dayPriceSize}个`
    ]
    
    cacheLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 输出性能统计
   */
  static logPerformanceStats(stats: {
    totalTime: number
    apiCalls: number
    cacheMisses: number
    cacheHits: number
  }) {
    const perfLines = [
      '⚡ ========== 性能统计 ==========',
      `⏱️  总耗时: ${stats.totalTime.toFixed(2)}秒`,
      `📞 API调用: ${stats.apiCalls}次`,
      `💾 缓存命中: ${stats.cacheHits}次`,
      `🔍 缓存未命中: ${stats.cacheMisses}次`,
      `📊 缓存命中率: ${((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(1)}%`
    ]
    
    perfLines.forEach(line => {
      this.logs.push(line)
      this.safeLog(line)
    })
  }
  
  /**
   * 手动保存日志文件
   */
  static async saveLogFile() {
    if (this.logs.length === 0) {
      this.safeLog('📄 没有日志需要保存')
      return
    }

    try {
      // 同时保存到服务器和浏览器下载
      await this.saveToServer()
      await this.saveToFile()
    } catch (error) {
      console.error('❌ 保存日志失败:', error)
      // 降级到仅浏览器下载
      await this.saveToFile()
    }
  }

  /**
   * 保存日志到服务器
   */
  private static async saveToServer() {
    if (!this.isClient || this.logs.length === 0) return

    try {
      const logContent = this.logs.join('\n') + '\n'
      const fileName = this.generateLogFileName()

      const response = await fetch('/api/save-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          content: logContent
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        this.safeLog(`📁 日志已保存到服务器: ${result.filePath}`)
      } else {
        throw new Error(result.error || '服务器保存失败')
      }
    } catch (error) {
      console.warn('⚠️ 服务器保存日志失败，将使用浏览器下载:', error)
      throw error
    }
  }
  
  /**
   * 获取所有日志
   */
  static getAllLogs(): string[] {
    return [...this.logs]
  }
  
  /**
   * 清空日志
   */
  static clearLogs() {
    this.logs = []
  }
} 