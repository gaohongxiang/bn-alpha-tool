"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, X, ArrowUpDown, Loader2, AlertCircle, Settings, CheckCircle, ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ethers } from "ethers"
import { PointsUtils } from "@/components/points-utils"
import { apiManager } from "./api-manager"
import { APIConfigPanel } from "./api-config-panel"
import { TimeUtils } from "./time-utils"
import { TokenPriceUtils } from "./token-price-utils"
import { TradingPairAnalyzer } from "./transaction-analyzer"
import { configManager } from "../lib/config-manager"
import { LogManager } from "./log-manager"
import { SharedCache } from "./shared-cache"
import { BalanceManager, type BalanceQueryResult } from "./balance-manager"

interface Wallet {
  address: string
  note: string
}

interface TokenBalance {
  symbol: string
  balance: number
  usdValue: number
  contractAddress?: string
}

interface WalletData {
  address: string
  note: string
  totalBalance: number
  tokenBalances: TokenBalance[]
  tradingVolume: number
  transactionCount: number
  estimatedPoints: number
  revenue: number
  gasUsed: number
  tradingLoss: number
  gasLoss: number
  isLoading?: boolean
  error?: string
}

interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  tokenSymbol: string
  tokenName: string
  gasUsed: string
  gasPrice: string
  blockNumber: number
  timestamp: number
  usdValue: number
  fromToken?: string
  toToken?: string
  fromAmount?: number
  toAmount?: number
}

interface RevenueDisplayProps {
  // 兼容app/page.tsx传入的props
  wallets?: Wallet[]
  setWallets?: React.Dispatch<React.SetStateAction<Wallet[]>>
  walletData?: WalletData[]
  setWalletData?: React.Dispatch<React.SetStateAction<WalletData[]>>
  hasQueried?: boolean
  setHasQueried?: React.Dispatch<React.SetStateAction<boolean>>
}

export function RevenueDisplay(props: RevenueDisplayProps = {}) {
  // 时间范围说明：每天从早上8点到第二天早上8点算1天
  // 例如：2025-06-08 代表 2025-06-08 08:00:00 ~ 2025-06-09 07:59:59 (UTC+8)

  // 使用当前日期作为默认值
  const [selectedDate, setSelectedDate] = useState(() => {
    return TimeUtils.getBeiJingToday()
  })
  const [viewMode, setViewMode] = useState("table")
  const [sortBy, setSortBy] = useState("default")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // 钱包相关状态 - 支持外部传入或内部管理
  const [internalWallets, setInternalWallets] = useState<Wallet[]>([])
  const [internalWalletData, setInternalWalletData] = useState<WalletData[]>([])
  const [internalHasQueried, setInternalHasQueried] = useState(false)

  // 使用外部传入的状态或内部状态
  const wallets = props.wallets ?? internalWallets
  const setWallets = props.setWallets ?? setInternalWallets
  const walletData = props.walletData ?? internalWalletData
  const setWalletData = props.setWalletData ?? setInternalWalletData
  const hasQueried = props.hasQueried ?? internalHasQueried
  const setHasQueried = props.setHasQueried ?? setInternalHasQueried

  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [walletInput, setWalletInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWallets, setSelectedWallets] = useState<string[]>([])

  // 查询相关状态
  const [isQuerying, setIsQuerying] = useState(false)

  // 网络状态（简化版，主要由API管理器处理）
  const [networkStatus, setNetworkStatus] = useState<"connecting" | "connected" | "error">("connected")
  const [bnbPrice, setBnbPrice] = useState(600) // BNB/USDT价格
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)

  // 交易详情弹窗状态
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [selectedWalletTransactions, setSelectedWalletTransactions] = useState<Transaction[]>([])
  const [selectedWalletAddress, setSelectedWalletAddress] = useState("")
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)

  // 缓存每个钱包的交易数据，避免重复查询
  const [walletTransactionsCache, setWalletTransactionsCache] = useState<{ [address: string]: Transaction[] }>({})

  // 弹窗状态
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [apiConfigOpen, setApiConfigOpen] = useState(false)

  // 获取实时BNB价格 (使用TokenPriceUtils的真实价格获取)
  const fetchBNBPrice = useCallback(async () => {
    try {
      setIsLoadingPrice(true)
      const price = await TokenPriceUtils.getCurrentBNBPrice()
      setBnbPrice(price)
      LogManager.addLog('价格', `BNB价格更新: $${price}`)
    } catch (error) {
      LogManager.addLog('错误', `BNB价格获取失败: ${error}`)
      setBnbPrice(600) // 使用默认价格
    } finally {
      setIsLoadingPrice(false)
    }
  }, [])

  // 初始化配置管理器和API管理器
  useEffect(() => {
    const initializeManagers = async () => {
      try {
        LogManager.addLog('系统', '初始化配置管理器和API管理器...')

        // 初始化配置管理器
        await configManager.initialize()

        // 等待API管理器初始化
        await apiManager.waitForInitialization()

        LogManager.addLog('系统', '管理器初始化完成')

        // 获取BNB价格
        fetchBNBPrice()

        // 每5分钟更新一次价格
        const interval = setInterval(fetchBNBPrice, 5 * 60 * 1000)
        return () => clearInterval(interval)
      } catch (error) {
        LogManager.addLog('错误', `管理器初始化失败: ${error}`)
        // 即使初始化失败，也要获取BNB价格
        fetchBNBPrice()
      }
    }

    initializeManagers()
  }, [fetchBNBPrice])

  // 钱包持久化 - 从localStorage读取
  useEffect(() => {
    try {
      const savedWallets = localStorage.getItem('revenue-display-wallets')
      if (savedWallets) {
        const parsedWallets = JSON.parse(savedWallets) as Wallet[]
        if (!props.wallets) { // 只有在没有外部传入时才从localStorage恢复
          setInternalWallets(parsedWallets)
        }
        LogManager.addLog('系统', `从localStorage恢复了 ${parsedWallets.length} 个钱包`)
      }
    } catch (error) {
      LogManager.addLog('错误', `读取钱包数据失败: ${error}`)
    }
  }, [props.wallets])

  // 钱包持久化 - 保存到localStorage
  useEffect(() => {
    if (wallets.length > 0 && !props.wallets) { // 只有在内部管理状态时才保存
      try {
        localStorage.setItem('revenue-display-wallets', JSON.stringify(wallets))
        LogManager.addLog('系统', `保存了 ${wallets.length} 个钱包到localStorage`)
      } catch (error) {
        LogManager.addLog('错误', `保存钱包数据失败: ${error}`)
      }
    }
  }, [wallets, props.wallets])

  // 网络状态初始化（简化版，主要由API管理器处理）
  useEffect(() => {
    setNetworkStatus("connected")
  }, [])

  // 初始化BalanceManager的BNB价格
  useEffect(() => {
    BalanceManager.setBNBPrice(bnbPrice)
  }, [bnbPrice])

  // 使用API管理器查询钱包数据（真正的并行查询）
  const queryWalletDataWithAPI = useCallback(async (wallet: Wallet, walletIndex: number): Promise<WalletData> => {
    try {
      // 获取代币余额（使用新的BalanceManager）
      const balanceResult = await BalanceManager.getWalletBalance(wallet.address, selectedDate)
      const tokenBalances = balanceResult.tokenBalances
      const totalBalance = balanceResult.totalUsdValue

      // 使用新的交易分析器获取交易数据
      LogManager.addLog('分析', `钱包 ${walletIndex + 1}: 使用新的交易分析器查询交易数据`)
      const analysisResult = await TradingPairAnalyzer.analyzeByDate(wallet.address, selectedDate)

      // 转换数据格式以兼容原有界面
      const transactions: Transaction[] = analysisResult.result.allExchanges.transactions.map(tx => ({
        hash: tx.hash,
        from: wallet.address,
        to: tx.toToken || '',
        value: tx.fromAmount.toString(),
        tokenSymbol: `${tx.fromToken}→${tx.toToken}`,
        tokenName: `${tx.fromToken} to ${tx.toToken}`,
        gasUsed: tx.gasUsed.toString(),
        gasPrice: '0',
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        usdValue: tx.fromAmount, // 简化处理，使用fromAmount作为usdValue
        fromToken: tx.fromToken,
        toToken: tx.toToken,
        fromAmount: tx.fromAmount,
        toAmount: tx.toAmount
      }))

      // 缓存交易数据
      setWalletTransactionsCache(prev => ({
        ...prev,
        [wallet.address]: transactions
      }))

      // 获取分析结果
      const tradingLoss = analysisResult.result.tradingLoss.lossValue
      const gasLoss = analysisResult.result.gasLoss.totalGasValue
      const totalVolume = analysisResult.result.validTransactions.volume
      const transactionCount = analysisResult.result.validTransactions.count

      // 计算预估积分 - 使用新的余额积分计算逻辑
      const balanceForPoints = BalanceManager.calculatePointsBalance(tokenBalances)
      const balancePoints = PointsUtils.balance(balanceForPoints)
      
      LogManager.addLog('积分', `钱包 ${walletIndex + 1} 余额积分计算: 
        - 查询策略: ${balanceResult.queryStrategy}
        - 余额标签: ${balanceResult.balanceTag}
        - 用于积分的余额: $${balanceForPoints.toFixed(2)}
        - 余额积分: ${balancePoints}分`)

      const tradingVolumePoints = PointsUtils.bscTradingVolume(totalVolume)

      const estimatedPoints = balancePoints + tradingVolumePoints

      LogManager.addLog('完成', `钱包 ${walletIndex + 1} 新分析器完成: 交易磨损 $${tradingLoss.toFixed(2)}, Gas费 $${gasLoss.toFixed(2)}`)

      return {
        address: wallet.address,
        note: wallet.note,
        totalBalance,
        tokenBalances,
        tradingVolume: totalVolume,
        transactionCount: transactionCount,
        estimatedPoints,
        revenue: tradingLoss, // 交易磨损
        gasUsed: gasLoss, // Gas磨损（USDT价值）
        tradingLoss: tradingLoss, // 新的交易磨损计算
        gasLoss: gasLoss, // 新的Gas费计算
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      LogManager.addLog('错误', `钱包 ${walletIndex + 1} API查询失败: ${errorMessage}`)
      return {
        address: wallet.address,
        note: wallet.note,
        totalBalance: 0,
        tokenBalances: [],
        tradingVolume: 0,
        transactionCount: 0,
        estimatedPoints: 0,
        revenue: 0,
        gasUsed: 0,
        tradingLoss: 0,
        gasLoss: 0,
        error: errorMessage,
      }
    }
  }, [selectedDate, setWalletTransactionsCache])

  // 批量查询钱包数据 - 使用API管理器进行真正的并行查询
  const handleBatchQuery = useCallback(async () => {
    if (wallets.length === 0) return

    const startTime = Date.now()
    const sessionId = `WALLET_BATCH_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}`
    
    // 开始新的查询会话
    LogManager.startSession(sessionId)

    setIsQuerying(true)
    setHasQueried(true)

    // 清除之前的交易缓存，确保数据一致性
    setWalletTransactionsCache({})
    LogManager.addLog('缓存', '清除交易缓存，重新查询所有钱包数据')

    // 查询过程中只显示loading状态，不显示具体数据
    setWalletData([])

    try {
      // 等待API管理器完全初始化，然后打印API状态
      await apiManager.waitForInitialization()
      
      const apiStats = apiManager.getAPIStats()
      LogManager.logAPIStatus(apiStats)
      
      // 添加详细的API调试信息
      const networkConfig = apiManager.getCurrentNetworkConfig()
      LogManager.addLog('调试', `当前网络配置: ${networkConfig ? '已加载' : '未加载'}`)
      if (networkConfig) {
        LogManager.addLog('调试', `BSCScan API配置: ${networkConfig.apis?.bscscan ? '存在' : '不存在'}`)
        if (networkConfig.apis?.bscscan) {
          const bscscanAPI = networkConfig.apis.bscscan
          LogManager.addLog('调试', `BSCScan API Keys数量: ${bscscanAPI.keys?.length || 0}`)
          LogManager.addLog('调试', `BSCScan Base URL: ${bscscanAPI.baseUrl}`)
          
          // 测试第一个API Key
          if (bscscanAPI.keys && bscscanAPI.keys.length > 0) {
            const firstKey = bscscanAPI.keys[0]
            LogManager.addLog('调试', `第一个API Key: ${firstKey.key.substring(0, 8)}... (active: ${firstKey.active})`)
          }
        }
      }

      // 获取配置统计
      const configStats = configManager.getStats()
      if (configStats) {
        LogManager.logConfigSummary(configStats)
      }

      // 获取缓存状态
      const cacheStats = SharedCache.getCacheStats()
      LogManager.logCacheStatus(cacheStats)

      // 开始钱包分析
      LogManager.logWalletQueryStart(wallets.length, selectedDate)

      const results: WalletData[] = new Array(wallets.length)
      
      // 根据活跃API数量决定并发数
      const maxConcurrency = Math.min(apiStats.activeKeys, Math.max(2, wallets.length))
      LogManager.addLog('并发', `并发数设置: ${maxConcurrency}（基于${apiStats.activeKeys}个活跃API Key）`)

      // 创建所有查询任务
      const queryTasks = wallets.map((wallet, index) => async () => {
        try {
          LogManager.addLog('查询', `API查询 ${index + 1}/${wallets.length}: ${wallet.address}`)
          const result = await queryWalletDataWithAPI(wallet, index)
          results[index] = result
          
          // 输出单个钱包结果
          LogManager.logWalletResult(index, wallets.length, wallet, result)
        } catch (error) {
          LogManager.addLog('错误', `钱包 ${index + 1} 查询失败: ${error}`)
          const errorResult: WalletData = {
            address: wallet.address,
            note: wallet.note,
            totalBalance: 0,
            tokenBalances: [],
            tradingVolume: 0,
            transactionCount: 0,
            estimatedPoints: 0,
            revenue: 0,
            gasUsed: 0,
            tradingLoss: 0,
            gasLoss: 0,
            error: error instanceof Error ? error.message : "查询失败",
          }
          results[index] = errorResult
        }
      })

      // 优化的并发控制执行 - 确保API不会闲置
      const executing: Promise<void>[] = []
      let taskIndex = 0

      // 启动初始批次任务
      for (let i = 0; i < Math.min(maxConcurrency, queryTasks.length); i++) {
        if (taskIndex < queryTasks.length) {
          const task = queryTasks[taskIndex++]
          executing.push(task())
        }
      }

      // 等待所有任务完成
      await Promise.allSettled(executing)
      
      // 启动剩余的任务
      while (taskIndex < queryTasks.length) {
        const remainingTasks = []
        for (let i = 0; i < Math.min(maxConcurrency, queryTasks.length - taskIndex); i++) {
          const task = queryTasks[taskIndex++]
          remainingTasks.push(task())
        }
        
        if (remainingTasks.length > 0) {
          LogManager.addLog('并发', `启动下一批任务: ${remainingTasks.length}个`)
          await Promise.allSettled(remainingTasks)
        }
      }

      // 计算性能统计
      const endTime = Date.now()
      const totalTime = (endTime - startTime) / 1000

      // 输出批量查询总结
      LogManager.logBatchSummary(results.filter(result => result !== undefined))
      
      // 输出性能统计
      LogManager.logPerformanceStats({
        totalTime,
        apiCalls: 0, // TODO: 从API管理器获取实际调用次数
        cacheMisses: 0, // TODO: 从缓存管理器获取
        cacheHits: 0 // TODO: 从缓存管理器获取
      })

      // 等所有查询完成后，统一更新UI显示数据
      LogManager.addLog('界面', '所有查询完成，更新UI显示数据')
      setWalletData(results.filter(result => result !== undefined))
      
    } catch (error) {
      LogManager.addLog('错误', `批量并行查询发生错误: ${error}`)
    } finally {
      setIsQuerying(false)
      await LogManager.endSession()
    }
  }, [wallets, selectedDate, queryWalletDataWithAPI, setWalletData, setHasQueried, setWalletTransactionsCache])

  // 查询交易详情
  const handleViewTransactionDetails = useCallback(async (address: string) => {
    setSelectedWalletAddress(address)
    setTransactionModalOpen(true)
    setIsLoadingTransactions(true)

    try {
      // 首先检查缓存
      const cachedTransactions = walletTransactionsCache[address]
      if (cachedTransactions) {
        LogManager.addLog('缓存', `使用缓存的交易数据，共 ${cachedTransactions.length} 笔交易`)
        setSelectedWalletTransactions(cachedTransactions)
        setIsLoadingTransactions(false)
        return
      }

      // 如果缓存中没有，重新使用交易分析器查询
      LogManager.addLog('查询', `缓存中没有数据，重新查询钱包 ${address} 的交易`)
      const analysisResult = await TradingPairAnalyzer.analyzeByDate(address, selectedDate)
      
      // 转换数据格式
      const transactions: Transaction[] = analysisResult.result.allExchanges.transactions.map(tx => ({
        hash: tx.hash,
        from: address,
        to: tx.toToken || '',
        value: tx.fromAmount.toString(),
        tokenSymbol: `${tx.fromToken}→${tx.toToken}`,
        tokenName: `${tx.fromToken} to ${tx.toToken}`,
        gasUsed: tx.gasUsed.toString(),
        gasPrice: '0',
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        usdValue: tx.fromAmount,
        fromToken: tx.fromToken,
        toToken: tx.toToken,
        fromAmount: tx.fromAmount,
        toAmount: tx.toAmount
      }))
      
      setSelectedWalletTransactions(transactions)
      
      // 同时更新缓存
      setWalletTransactionsCache(prev => ({
        ...prev,
        [address]: transactions
      }))
    } catch (error) {
      LogManager.addLog('错误', `加载交易数据失败: ${error}`)
      setSelectedWalletTransactions([])
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [walletTransactionsCache, selectedDate, setWalletTransactionsCache])

  // 重新查询单个钱包
  const handleRetryWallet = useCallback(async (walletAddress: string) => {
    const walletIndex = wallets.findIndex(w => w.address === walletAddress)
    if (walletIndex === -1) return

    const wallet = wallets[walletIndex]
    
    // 更新该钱包状态为加载中
    setWalletData(prev => prev.map(w => 
      w.address === walletAddress 
        ? { ...w, isLoading: true, error: undefined }
        : w
    ))

    try {
      LogManager.addLog('重试', `重新查询钱包: ${walletAddress}`)
      const result = await queryWalletDataWithAPI(wallet, walletIndex)
      
      // 更新该钱包的数据
      setWalletData(prev => prev.map(w => 
        w.address === walletAddress ? result : w
      ))
      
      // 清除该钱包的交易缓存，强制重新获取
      setWalletTransactionsCache(prev => {
        const newCache = { ...prev }
        delete newCache[walletAddress]
        return newCache
      })
      
      LogManager.addLog('重试', `钱包 ${walletAddress} 重新查询成功`)
    } catch (error) {
      LogManager.addLog('错误', `钱包 ${walletAddress} 重新查询失败: ${error}`)
      
      // 更新错误状态
      setWalletData(prev => prev.map(w => 
        w.address === walletAddress 
          ? { 
              ...w, 
              isLoading: false, 
              error: error instanceof Error ? error.message : "重新查询失败" 
            }
          : w
      ))
    }
  }, [wallets, queryWalletDataWithAPI, setWalletData, setWalletTransactionsCache])

  // 计算总计数据
  const totalStats = useMemo(() => {
    return {
      totalTransactions: walletData.reduce((sum, wallet) => sum + wallet.transactionCount, 0),
      totalVolume: walletData.reduce((sum, wallet) => sum + wallet.tradingVolume, 0),
      totalRevenue: walletData.reduce((sum, wallet) => sum + wallet.revenue, 0),
      totalPoints: walletData.reduce((sum, wallet) => sum + wallet.estimatedPoints, 0),
      totalBalance: walletData.reduce((sum, wallet) => {
        // 使用新的余额计算逻辑
        return sum + BalanceManager.calculatePointsBalance(wallet.tokenBalances);
      }, 0),
      totalGasUsed: walletData.reduce((sum, wallet) => sum + wallet.gasUsed, 0),
      totalUsdtValueChange: walletData.reduce((sum, wallet) => sum + (wallet.tradingLoss || 0), 0),
      totalTradingLoss: walletData.reduce((sum, wallet) => sum + (wallet.tradingLoss || 0), 0),
      totalGasLoss: walletData.reduce((sum, wallet) => sum + (wallet.gasLoss || 0), 0),
    }
  }, [walletData])

  // 截断钱包地址
  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // 使用现代 Clipboard API
        await navigator.clipboard.writeText(text)
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement("textarea")
        textArea.value = text
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
      }

      // 可以添加成功提示（可选）
      LogManager.addLog('操作', `地址已复制到剪贴板: ${text.substring(0, 10)}...`)
    } catch (err) {
      LogManager.addLog('错误', `复制失败: ${err}`)
      // 降级方案
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand("copy")
        LogManager.addLog('操作', '使用降级方案复制成功')
      } catch (fallbackErr) {
        LogManager.addLog('错误', `降级方案也失败了: ${fallbackErr}`)
      }
      document.body.removeChild(textArea)
    }
  }, [])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
  }

  const handleImportWallets = useCallback(() => {
    const lines = walletInput.trim().split("\n")
    const newWallets = lines
      .map((line) => {
        const parts = line.split(",")
        const address = parts[0].trim()
        const note = parts.length > 1 ? parts[1].trim() : "-"

        if (!ethers.isAddress(address)) {
          LogManager.addLog('警告', `无效地址: ${address}`)
          return null
        }

        return { address, note }
      })
      .filter(
        (wallet): wallet is Wallet =>
          wallet !== null && !wallets.some((existing) => existing.address === wallet.address),
      )

    if (newWallets.length > 0) {
      setWallets((prev) => [...prev, ...newWallets])
    }

    setWalletModalOpen(false)
    setWalletInput("")
  }, [wallets, walletInput])

  const handleRemoveWallet = useCallback((addressToRemove: string) => {
    setWallets((prev) => prev.filter((wallet) => wallet.address !== addressToRemove))
    setWalletData((prev) => prev.filter((data) => data.address !== addressToRemove))

    if (wallets.length <= 1) {
      setHasQueried(false)
      setWalletData([])
    }
  }, [wallets, setWallets, setWalletData, setHasQueried])

  const filteredWallets = walletData.filter(
    (wallet) =>
      wallet.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wallet.note.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSort = (sortType: string) => {
    if (sortBy === sortType) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortBy(sortType)
      setSortDirection("desc")
    }
  }

  const sortedWallets = useMemo(() => {
    return [...filteredWallets].sort((a, b) => {
      let comparison = 0

      if (sortBy === "volume") {
        comparison = a.tradingVolume - b.tradingVolume
      } else if (sortBy === "points") {
        comparison = a.estimatedPoints - b.estimatedPoints
      } else if (sortBy === "revenue") {
        comparison = a.revenue - b.revenue
      } else if (sortBy === "balance") {
        comparison = a.totalBalance - b.totalBalance
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [filteredWallets, sortBy, sortDirection])

  const handleSelectWallet = useCallback((address: string, checked: boolean) => {
    if (checked) {
      setSelectedWallets((prev) => [...prev, address])
    } else {
      setSelectedWallets((prev) => prev.filter((addr) => addr !== address))
    }
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedWallets(wallets.map((wallet) => wallet.address))
    } else {
      setSelectedWallets([])
    }
  }, [wallets])

  const handleBatchDelete = useCallback(() => {
    const remainingWallets = wallets.filter((wallet) => !selectedWallets.includes(wallet.address))
    const remainingData = walletData.filter((data) => !selectedWallets.includes(data.address))

    setWallets(remainingWallets)
    setWalletData(remainingData)
    setSelectedWallets([])

    if (remainingWallets.length === 0) {
      setHasQueried(false)
    }
  }, [wallets, walletData, selectedWallets, setWallets, setWalletData, setHasQueried, setSelectedWallets])

  const getNetworkStatusBadge = () => {
    switch (networkStatus) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            已连接
          </Badge>
        )
      case "connecting":
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            连接中
          </Badge>
        )
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            连接失败
          </Badge>
        )
      default:
        return null
    }
  }

  // 导出数据功能
  const handleExportData = useCallback(async () => {
    if (walletData.length === 0) {
      LogManager.addLog('导出', '没有可导出的钱包数据')
      return
    }

    try {
      LogManager.addLog('导出', `开始导出${selectedDate}的钱包数据，共${walletData.length}个钱包`)
      
      // 准备导出数据
      const exportData = {
        selectedDate,
        walletData,
        totalStats
      }
      
      // 调用API导出到服务器
      const response = await fetch('/api/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData)
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        LogManager.addLog('导出', `数据导出成功: ${result.filePath}`)
        
        // 同时提供浏览器下载选项
        const content = generateDataContentForDownload(selectedDate, walletData, totalStats)
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `wallet-data-${selectedDate}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        LogManager.addLog('导出', '浏览器下载也已启动')
      } else {
        throw new Error(result.error || '导出失败')
      }
    } catch (error) {
      LogManager.addLog('错误', `数据导出失败: ${error}`)
      
      // 降级到仅浏览器下载
      try {
        const content = generateDataContentForDownload(selectedDate, walletData, totalStats)
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `wallet-data-${selectedDate}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        LogManager.addLog('导出', '使用浏览器下载方式导出数据')
      } catch (downloadError) {
        LogManager.addLog('错误', `浏览器下载也失败: ${downloadError}`)
      }
    }
  }, [selectedDate, walletData, totalStats])

  // 生成浏览器下载用的数据内容
  const generateDataContentForDownload = useCallback((selectedDate: string, walletData: WalletData[], totalStats: any): string => {
    const lines: string[] = []
    const timestamp = new Date().toLocaleString('zh-CN')
    
    // 文件头部信息
    lines.push('===============================================')
    lines.push('            钱包数据分析报告')
    lines.push('===============================================')
    lines.push(`查询日期: ${selectedDate}`)
    lines.push(`导出时间: ${timestamp}`)
    lines.push(`钱包数量: ${walletData.length}`)
    lines.push(`时间范围: 每日8:00-次日7:59 (UTC+8)`)
    lines.push('')
    
    // 总体统计
    lines.push('===============================================')
    lines.push('                总体统计')
    lines.push('===============================================')
    lines.push(`总余额:        $${totalStats?.totalBalance?.toFixed(2) || '0.00'}`)
    lines.push(`总交易量:      $${totalStats?.totalVolume?.toFixed(2) || '0.00'}`)
    lines.push(`总交易次数:    ${totalStats?.totalTransactions || 0}`)
    lines.push(`总交易磨损:    $${totalStats?.totalTradingLoss?.toFixed(2) || '0.00'}`)
    lines.push(`总Gas费:       $${totalStats?.totalGasLoss?.toFixed(2) || '0.00'}`)
    lines.push(`总磨损:        $${((totalStats?.totalTradingLoss || 0) + (totalStats?.totalGasLoss || 0)).toFixed(2)}`)
    lines.push(`总预估积分:    ${totalStats?.totalPoints || 0}分`)
    lines.push('')
    
    // 各钱包详细数据
    lines.push('===============================================')
    lines.push('              各钱包详细数据')
    lines.push('===============================================')
    
    walletData.forEach((wallet, index) => {
      lines.push('')
      lines.push(`【钱包 ${index + 1}】`)
      lines.push('-----------------------------------------------')
      lines.push(`地址:         ${wallet.address}`)
      lines.push(`备注:         ${wallet.note}`)
      
      if (wallet.error) {
        lines.push(`状态:         ❌ 查询失败`)
        lines.push(`错误信息:     ${wallet.error}`)
      } else {
        lines.push(`状态:         ✅ 查询成功`)
        lines.push('')
        
        // 余额信息
        lines.push('【余额信息】')
        if (wallet.tokenBalances && wallet.tokenBalances.length > 0) {
          wallet.tokenBalances
            .filter(token => token.usdValue > 0)
            .forEach(token => {
              lines.push(`  ${token.symbol}: ${token.balance.toFixed(6)} ($${token.usdValue.toFixed(2)})`)
            })
          const totalBalance = wallet.tokenBalances
            .filter(token => token.usdValue > 0)
            .reduce((sum, token) => sum + token.usdValue, 0)
          lines.push(`  总余额: $${totalBalance.toFixed(2)}`)
        } else {
          lines.push('  无余额数据')
        }
        lines.push('')
        
        // 交易信息
        lines.push('【交易信息】')
        lines.push(`  交易量:       $${wallet.tradingVolume?.toFixed(2) || '0.00'}`)
        lines.push(`  交易次数:     ${wallet.transactionCount || 0}`)
        lines.push(`  交易磨损:     $${wallet.tradingLoss?.toFixed(2) || '0.00'}`)
        lines.push(`  Gas费:        $${wallet.gasLoss?.toFixed(2) || '0.00'}`)
        lines.push(`  总磨损:       $${((wallet.tradingLoss || 0) + (wallet.gasLoss || 0)).toFixed(2)}`)
        lines.push('')
        
        // 积分信息
        lines.push('【积分信息】')
        lines.push(`  预估总积分:   ${wallet.estimatedPoints || 0}分`)
        const balanceValue = wallet.tokenBalances ? 
          BalanceManager.calculatePointsBalance(wallet.tokenBalances) : 0
        
        // 使用真实的积分计算
        const balancePoints = PointsUtils.balance(balanceValue)
        const tradingPoints = PointsUtils.bscTradingVolume(wallet.tradingVolume || 0)
        lines.push(`  余额积分:     ${balancePoints}分`)
        lines.push(`  交易积分:     ${tradingPoints}分`)
      }
    })
    
    // 文件尾部
    lines.push('')
    lines.push('===============================================')
    lines.push('              报告结束')
    lines.push('===============================================')
    lines.push(`生成时间: ${timestamp}`)
    lines.push('注：积分计算为预估值，实际积分以官方为准')
    
    return lines.join('\n')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 页面标题和基本控制 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRulesModalOpen(true)}
              className="flex items-center gap-2 text-green-600 hover:bg-green-50"
            >
              <AlertCircle className="w-4 h-4" />
              查看交易统计规则
            </Button>
          </div>
        </div>

        {/* 操作控制区域 */}
        <div className="mb-8">
          {/* 查询日期设置 */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-gray-700">查询日期:</label>
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={handleDateChange} 
              className="w-40" 
              disabled={isQuerying}
            />
            <span className="text-xs text-gray-500">
              每日8:00-次日7:59 (UTC+8)
            </span>
          </div>
          
          {/* 主要操作按钮 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white py-3 text-base font-medium"
              onClick={() => setWalletModalOpen(true)}
              disabled={isQuerying}
            >
              钱包管理 ({wallets.length})
            </Button>
            
            <Button
              className="bg-green-500 hover:bg-green-600 text-white py-3 text-base font-medium flex items-center justify-center gap-2"
              onClick={handleBatchQuery}
              disabled={wallets.length === 0 || isQuerying}
            >
              {isQuerying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  查询中...
                </>
              ) : (
                "批量查询数据"
              )}
            </Button>
            
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white py-3 text-base font-medium flex items-center justify-center gap-2"
              onClick={() => setApiConfigOpen(true)}
              disabled={isQuerying}
            >
              <Settings className="w-4 h-4" />
              API管理
            </Button>
          </div>

        </div>





        {/* 总数据统计 */}
        {walletData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-normal mb-4">链上数据统计</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">总余额</div>
                  <div className="text-xl font-normal text-green-600">${totalStats.totalBalance.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">有效交易次数</div>
                  <div className="text-xl font-normal">{totalStats.totalTransactions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">交易额</div>
                  <div className="text-xl font-normal text-blue-600">${totalStats.totalVolume.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">总磨损(USDT)</div>
                  <div className="text-xl font-normal text-red-500">${totalStats.totalRevenue.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">预估总积分</div>
                  <div className="text-xl font-normal text-purple-600">{totalStats.totalPoints}分</div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 查询中的状态显示 */}
        {isQuerying && (
          <div className="text-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-green-500" />
              <h3 className="text-xl font-normal text-gray-700">正在查询钱包数据...</h3>
              <p className="text-gray-500">
                正在分析 {wallets.length} 个钱包在 {selectedDate} 的交易数据，请稍候
              </p>
              <div className="bg-green-50 px-6 py-4 rounded-lg border border-blue-200 max-w-md">
                <p className="text-sm text-green-700">
                  💡 查询完成后将显示：余额、有效交易、磨损明细、预估积分等数据
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 数据展示区域 */}
        {!isQuerying && walletData.length > 0 ? (
          <>
            {/* 视图控制 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-light">排序</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-32 font-light">
                      <SelectValue placeholder="默认排序" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">默认排序</SelectItem>
                      <SelectItem value="balance">余额</SelectItem>
                      <SelectItem value="volume">交易额</SelectItem>
                      <SelectItem value="points">积分</SelectItem>
                      <SelectItem value="revenue">收益</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Input
                  placeholder="搜索钱包地址或备注"
                  className="w-64 font-light"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="rounded-none font-light"
                  >
                    表格
                  </Button>
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("card")}
                    className="rounded-none font-light"
                  >
                    卡片
                  </Button>
                </div>
              </div>
            </div>

            {/* 数据表格 */}
            {viewMode === "table" ? (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 font-normal text-gray-700">钱包地址</th>
                          <th className="text-left py-3 px-4 font-normal text-gray-700">备注</th>
                          <th
                            className="text-left py-3 px-4 font-normal text-gray-700 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("balance")}
                          >
                            <div className="flex items-center gap-1">
                              当天余额 (USDT)
                              <ArrowUpDown className="h-4 w-4" />
                              {sortBy === "balance" && (
                                <span className="text-blue-500">{sortDirection === "asc" ? "↑" : "↓"}</span>
                              )}
                            </div>
                          </th>

                          <th
                            className="text-left py-3 px-4 font-normal text-gray-700 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("volume")}
                          >
                            <div className="flex items-center gap-1">
                              交易额 (USDT)
                              <ArrowUpDown className="h-4 w-4" />
                              {sortBy === "volume" && (
                                <span className="text-blue-500">{sortDirection === "asc" ? "↑" : "↓"}</span>
                              )}
                            </div>
                          </th>
                          <th className="text-left py-3 px-4 font-normal text-gray-700">有效交易次数</th>
                          <th
                            className="text-left py-3 px-4 font-normal text-gray-700 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("points")}
                          >
                            <div className="flex items-center gap-1">
                              预估总积分
                              <ArrowUpDown className="h-4 w-4" />
                              {sortBy === "points" && (
                                <span className="text-blue-500">{sortDirection === "asc" ? "↑" : "↓"}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className="text-left py-3 px-4 font-normal text-gray-700 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort("revenue")}
                          >
                            <div className="flex items-center gap-1">
                              磨损明细 (USDT)
                              <ArrowUpDown className="h-4 w-4" />
                              {sortBy === "revenue" && (
                                <span className="text-blue-500">{sortDirection === "asc" ? "↑" : "↓"}</span>
                              )}
                            </div>
                          </th>
                          <th className="text-left py-3 px-4 font-normal text-gray-700">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedWallets.map((wallet) => (
                          <tr key={wallet.address} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-light">{truncateAddress(wallet.address)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    copyToClipboard(wallet.address)
                                  }}
                                  className="h-6 w-6 p-0 hover:bg-blue-100"
                                  title="复制完整地址"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm font-light">{wallet.note}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-green-600 font-normal">
                                  $
                                  {BalanceManager.calculatePointsBalance(wallet.tokenBalances).toFixed(2)}
                                </span>

                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="text-blue-600 font-normal">${wallet.tradingVolume.toFixed(2)}</span>
                            </td>
                            <td className="py-3 px-4 font-light">{wallet.transactionCount}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-purple-600 font-normal text-lg">{wallet.estimatedPoints}分</span>
                                <div className="text-xs text-gray-500 mt-1">
                                  <div>余额积分: {PointsUtils.balance(
                                    BalanceManager.calculatePointsBalance(wallet.tokenBalances)
                                  )}分</div>
                                  <div>交易积分: {PointsUtils.bscTradingVolume(wallet.tradingVolume)}分</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-red-500 font-normal">${(wallet.revenue + wallet.gasUsed).toFixed(2)}</span>
                                <div className="text-xs text-gray-500 mt-1">
                                  <div>交易磨损: ${wallet.revenue.toFixed(2)}</div>
                                  <div>Gas磨损: ${wallet.gasUsed.toFixed(2)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {wallet.isLoading ? (
                                <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                                  <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                                  <span className="text-sm text-green-600 font-medium">查询中</span>
                                </div>
                              ) : wallet.error ? (
                                <Button
                                  size="sm"
                                  className="bg-red-500 hover:bg-red-600 text-white font-light"
                                  onClick={() => handleRetryWallet(wallet.address)}
                                >
                                  查询失败重试
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600 text-white font-light"
                                  onClick={() => handleViewTransactionDetails(wallet.address)}
                                >
                                  查看有效交易
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* 卡片视图 */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {sortedWallets.map((wallet) => (
                  <Card key={wallet.address} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-light">{truncateAddress(wallet.address)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              copyToClipboard(wallet.address)
                            }}
                            className="h-6 w-6 p-0 hover:bg-blue-100"
                            title="复制完整地址"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        {wallet.note !== "-" && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded font-light">{wallet.note}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow">
                      <div className="space-y-3 text-sm flex-grow">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-gray-600 font-light">当天余额</div>
                            <div className="text-green-600 font-normal">
                              $
                              {BalanceManager.calculatePointsBalance(wallet.tokenBalances).toFixed(2)}
                            </div>

                          </div>
                          <div>
                            <div className="text-gray-600 font-light">交易额</div>
                            <div className="text-blue-600 font-normal">${wallet.tradingVolume.toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="text-gray-600 font-light">有效交易</div>
                            <div className="font-normal">{wallet.transactionCount}</div>
                          </div>
                          <div>
                            <div className="text-gray-600 font-light">总积分</div>
                            <div className="text-purple-600 font-normal text-lg">{wallet.estimatedPoints}分</div>
                            <div className="text-xs text-gray-500 mt-1">
                              <div>余额: {PointsUtils.balance(
                                BalanceManager.calculatePointsBalance(wallet.tokenBalances)
                              )}分</div>
                              <div>交易: {PointsUtils.bscTradingVolume(wallet.tradingVolume)}分</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 font-light">磨损明细</div>
                            <div className="text-red-500 font-normal">${(wallet.revenue + wallet.gasUsed).toFixed(2)}</div>
                            <div className="text-xs text-gray-500">
                              <div>交易磨损: ${wallet.revenue.toFixed(2)}</div>
                              <div>Gas磨损: ${wallet.gasUsed.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        {wallet.isLoading ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                              <span className="text-sm text-green-600 font-medium">查询中...</span>
                            </div>
                          </div>
                        ) : wallet.error ? (
                          <Button
                            size="sm"
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-light"
                            onClick={() => handleRetryWallet(wallet.address)}
                          >
                            查询失败重试
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-light"
                            onClick={() => handleViewTransactionDetails(wallet.address)}
                          >
                            查看有效交易
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : !isQuerying && wallets.length > 0 && !hasQueried ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4 font-light">
              已添加 {wallets.length} 个钱包地址，选择日期后点击"批量查询数据"开始分析
            </p>
            <div className="bg-green-50 px-6 py-4 rounded-lg border border-green-200 max-w-md mx-auto mb-4">
              <p className="text-sm text-green-700">
                ⏰ 当前查询日期: {selectedDate} (每日8:00-次日7:59 UTC+8)
              </p>
            </div>
            <Button
              onClick={handleBatchQuery}
              className="bg-green-500 hover:bg-green-600 text-white font-light"
              disabled={isQuerying}
            >
              批量查询数据
            </Button>
          </div>
        ) : !isQuerying ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4 font-light">请先添加钱包地址以查看链上交易数据</p>
            <Button
              onClick={() => setWalletModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-light"
              disabled={isQuerying}
            >
              添加钱包
            </Button>
          </div>
        ) : null}
      </div>

      {/* 规则说明弹窗 */}
      <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📋 钱包交易统计规则说明
            </DialogTitle>
            <p className="text-gray-600 mt-2">详细了解交易识别、积分计算、磨损统计的完整规则</p>
          </DialogHeader>

          <div className="space-y-8 mt-6">
            {/* 时间规则说明 */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-200">
              <h3 className="text-xl font-bold text-indigo-800 mb-4 flex items-center gap-3">
                🕐 时间界定规则
              </h3>

              <div className="bg-white p-4 rounded-lg border border-indigo-200 shadow-sm">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-indigo-700 mb-2">📅 每日时间范围</h4>
                    <div className="text-sm space-y-1">
                      <div>• 开始：每日上午8:00（UTC+8）</div>
                      <div>• 结束：次日上午7:59（UTC+8）</div>
                      <div className="text-gray-600 mt-2">例：2025-06-10 表示 6月10日8:00 ~ 6月11日7:59</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-indigo-700 mb-2">🔄 自动识别</h4>
                    <div className="text-sm space-y-1">
                      <div>• 系统自动识别当前所属日期</div>
                      <div>• 凌晨0:00-7:59属于前一天</div>
                      <div className="text-gray-600 mt-2">当前时间自动匹配对应的交易统计日期</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 余额统计规则 */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
              <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-3">
                📊 当天余额统计
              </h3>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                  <h4 className="font-semibold text-blue-700 mb-2">📈 统计范围</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>USDT余额</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>BNB余额</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      <span className="text-gray-500">其他代币（不统计）</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                  <h4 className="font-semibold text-blue-700 mb-2">⏰ 计算时点</h4>
                  <div className="text-sm space-y-1">
                    <div>当天结束时的余额</div>
                    <div>当前查询时间的余额</div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                  <h4 className="font-semibold text-blue-700 mb-2">🎯 使用场景</h4>
                  <div className="text-sm space-y-1">
                    <div>• 积分计算的余额部分</div>
                    <div>• 钱包资产概览显示</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 有效交易规则 */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
              <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-3">
                📈 有效交易识别规则
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                    ✅ 计算交易量的交易对
                  </h4>
                  <div className="space-y-2">
                    <div className="bg-white px-4 py-2 rounded-lg border-l-4 border-green-400 shadow-sm">
                      <span className="font-medium text-green-800">USDT → ZKJ</span>
                      <span className="text-sm text-gray-600 ml-2">买入ZKJ</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg border-l-4 border-green-400 shadow-sm">
                      <span className="font-medium text-green-800">USDT → KOGE</span>
                      <span className="text-sm text-gray-600 ml-2">买入KOGE</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg border-l-4 border-green-400 shadow-sm">
                      <span className="font-medium text-green-800">ZKJ ↔ KOGE</span>
                      <span className="text-sm text-gray-600 ml-2">代币互换</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
                    ⚠️ 不计算交易量的交易
                  </h4>
                  <div className="space-y-2">
                    <div className="bg-orange-50 px-4 py-2 rounded-lg border-l-4 border-orange-400">
                      <span className="font-medium text-orange-800">ZKJ → USDT</span>
                      <span className="text-sm text-gray-600 ml-2">卖出ZKJ（仅计算Gas）</span>
                    </div>
                    <div className="bg-orange-50 px-4 py-2 rounded-lg border-l-4 border-orange-400">
                      <span className="font-medium text-orange-800">KOGE → USDT</span>
                      <span className="text-sm text-gray-600 ml-2">卖出KOGE（仅计算Gas）</span>
                    </div>
                    <div className="bg-red-50 px-4 py-2 rounded-lg border-l-4 border-red-400">
                      <span className="font-medium text-red-800">纯转账</span>
                      <span className="text-sm text-gray-600 ml-2">USDT转入/转出（影响磨损计算）</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                <p className="text-gray-700 text-sm">
                  💡 <strong>统计方式：</strong>每笔符合条件的交易计为1次有效交易，以USDT价值统计交易额。BSC链交易额会在积分计算时翻倍。
                </p>
              </div>
            </div>

            {/* 积分计算规则 */}
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200">
              <h3 className="text-xl font-bold text-purple-800 mb-4 flex items-center gap-3">
                🏆 积分计算体系
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                  <h4 className="font-semibold text-purple-700 mb-3">💰 余额积分</h4>
                  <div className="space-y-2 text-sm">
                    <div>• 统计范围：仅USDT + BNB余额</div>
                    <div>• 计算时点：当天截止时间的余额</div>
                    <div>• 积分公式：根据总USD价值对照积分表</div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                  <h4 className="font-semibold text-purple-700 mb-3">📊 交易量积分</h4>
                  <div className="space-y-2 text-sm">
                    <div>• 基础交易额：实际USDT交易量</div>
                    <div>• <span className="font-semibold text-orange-600">BSC链加成：交易额 × 2</span></div>
                    <div>• 积分转换：按加成后金额对照积分表</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🔢</span>
                  <strong className="text-purple-800">计算示例</strong>
                </div>
                <p className="text-gray-700 text-sm">
                  某钱包在BSC链实际交易额$20,000，加成后为$40,000，对照积分表获得15积分。
                  余额为$5,000（USDT+BNB），对照积分表获得3积分。总积分：15 + 3 = 18分。
                </p>
              </div>
            </div>

            {/* 磨损计算规则 */}
            <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
              <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-3">
                💸 磨损计算机制
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                  <h4 className="font-semibold text-red-700 mb-3">🔄 交易磨损</h4>
                  <div className="space-y-2 text-sm">
                    <div>📍 统计所有指定币对交易的买入和卖出</div>
                    <div>📍 计算买入价值与卖出价值的差额</div>
                    <div>📍 按交易时的USDT价格计算</div>
                    <div className="font-semibold text-red-600">💰 磨损 = 买入价值 - 卖出价值</div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                  <h4 className="font-semibold text-orange-700 mb-3">⛽ Gas费磨损</h4>
                  <div className="space-y-2 text-sm">
                    <div>📍 统计当天所有指定币对的交易的Gas消耗</div>
                    <div>📍 按实时BNB价格转换为USDT</div>
                    <div className="font-semibold text-orange-600">⛽ Gas费 = 总Gas消耗 × BNB价格</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📊</span>
                  <strong className="text-red-800">计算示例</strong>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-red-700">交易磨损示例：</strong><br />
                    买入：1000 USDT买ZKJ<br />
                    卖出：950 USDT卖ZKJ<br />
                    <span className="font-semibold text-red-600">交易磨损 = 50 USDT</span>
                  </div>
                  <div>
                    <strong className="text-orange-700">Gas磨损示例：</strong><br />
                    Gas消耗：0.002 BNB<br />
                    BNB价格：$600<br />
                    <span className="font-semibold text-orange-600">Gas磨损 = 1.2 USDT</span>
                  </div>
                </div>
              </div>
            </div>


          </div>

          <div className="flex justify-between items-center pt-6 border-t">
            <div className="text-sm text-gray-500">
              💡 规则会根据平台政策更新，请关注最新版本
            </div>
            <Button onClick={() => setRulesModalOpen(false)} className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              我已了解
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 交易详情弹窗 */}
      <Dialog open={transactionModalOpen} onOpenChange={setTransactionModalOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-normal">
              有效交易详情 - {truncateAddress(selectedWalletAddress)} ({selectedDate})
            </DialogTitle>
          </DialogHeader>

          {isLoadingTransactions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-3" />
              <span>加载交易数据中...</span>
            </div>
          ) : selectedWalletTransactions.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                共找到 {selectedWalletTransactions.length} 笔有效交易（按交易时USDT价值统计，最新交易在前）
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">交易哈希</th>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">交易对</th>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">交易数量</th>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">USDT价值</th>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">从</th>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">到</th>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">时间</th>
                      <th className="text-left py-3 px-4 font-normal text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWalletTransactions
                      .sort((a, b) => b.timestamp - a.timestamp) // 按时间戳降序排列（最新的在前）
                      .map((tx, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm">{truncateAddress(tx.hash)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-blue-600">{tx.tokenSymbol}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm">
                              <div>
                                {tx.fromAmount?.toFixed(4)} {tx.fromToken}
                              </div>
                              <div className="text-gray-500">↓</div>
                              <div>
                                {tx.toAmount?.toFixed(4)} {tx.toToken}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-green-600">${tx.usdValue.toFixed(2)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm">{truncateAddress(tx.from)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm">{truncateAddress(tx.to)}</span>
                          </td>
                          <td className="py-3 px-4">{new Date(tx.timestamp * 1000).toLocaleString("zh-CN")}</td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://bscscan.com/tx/${tx.hash}`, "_blank")}
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              查看
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">该日期没有找到有效交易记录</div>
          )}
        </DialogContent>
      </Dialog>

      {/* 钱包管理弹窗 */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-normal">钱包管理</DialogTitle>
          </DialogHeader>

          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="text-gray-700 mb-2 font-light">输入格式：每行一个BSC钱包地址，如需添加备注请用逗号分隔</p>
            <p className="text-sm text-gray-600 font-light">地址格式会自动验证，无效地址将被忽略</p>
          </div>

          <Textarea
            className="min-h-[200px] font-mono font-light"
            placeholder="0x1234567890123456789012345678901234567890&#10;0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,钱包1&#10;0x9876543210987654321098765432109876543210,Wallet2"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
          />

          <Button
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 text-base font-light"
            onClick={handleImportWallets}
          >
            批量导入
          </Button>

          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-normal">已添加的钱包 ({wallets.length})</h3>
              <div className="flex gap-2">
                {selectedWallets.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBatchDelete} className="font-light">
                    删除选中 ({selectedWallets.length})
                  </Button>
                )}
              </div>
            </div>

            {wallets.length > 0 ? (
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-12 p-3">
                        <input
                          type="checkbox"
                          checked={selectedWallets.length === wallets.length && wallets.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left p-3 font-normal text-gray-700">钱包地址</th>
                      <th className="text-left p-3 font-normal text-gray-700">备注</th>
                      <th className="w-20 p-3 font-normal text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((wallet) => (
                      <tr key={wallet.address} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedWallets.includes(wallet.address)}
                            onChange={(e) => handleSelectWallet(wallet.address, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-light">{truncateAddress(wallet.address)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-blue-100"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                copyToClipboard(wallet.address)
                              }}
                              title="复制完整地址"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-3 font-light">{wallet.note}</td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-100 text-red-600"
                            onClick={() => handleRemoveWallet(wallet.address)}
                            title="删除钱包"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 font-light">暂无钱包地址</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* API配置面板 */}
      <APIConfigPanel
        open={apiConfigOpen}
        onOpenChange={setApiConfigOpen}
      />
    </div>
  )
}
