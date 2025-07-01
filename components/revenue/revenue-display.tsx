"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, X, ArrowUpDown, Loader2, AlertCircle, Settings, CheckCircle, ExternalLink, Edit2, Save, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ethers } from "ethers"
import { PointsUtils } from "@/lib/utils/points-utils"
import { APIConfigPanel } from "@/components/config/api-config-panel"
import { TimeUtils } from "@/lib/utils/time-utils"
import { TokenPriceUtils } from "@/lib/utils/token-price-utils"
import { configManager } from "@/lib/config-manager"
import { LogManager } from "@/lib/log-manager"
import { BalanceService } from "@/services/analysis/balance-service"
import { TransactionAnalysisService } from "@/services/analysis/transaction-service"

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
  
  // 复制成功提示状态
  const [copyToast, setCopyToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
    position: { x: number; y: number };
  }>({ show: false, message: '', type: 'success', position: { x: 0, y: 0 } })
  
  // 添加通用Toast状态
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
  }>({ show: false, message: '', type: 'info' })

  // 添加确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
  }>({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: () => {}, 
    onCancel: () => {}, 
    confirmText: '确定',
    cancelText: '取消',
    type: 'info'
  })

  // 通用Toast显示函数
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    setToast({ show: true, message, type, title })
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 4000)
  }, [])

  // 通用确认对话框显示函数
  const showConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void,
    options?: {
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
    }
  ) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      onConfirm: () => {
        onConfirm()
        setConfirmDialog(prev => ({ ...prev, show: false }))
      },
      onCancel: () => {
        options?.onCancel?.()
        setConfirmDialog(prev => ({ ...prev, show: false }))
      },
      confirmText: options?.confirmText || '确定',
      cancelText: options?.cancelText || '取消',
      type: options?.type || 'info'
    })
  }, [])
  
  // 编辑状态
  const [editingWallet, setEditingWallet] = useState<string | null>(null)
  const [editingAddress, setEditingAddress] = useState('')
  const [editingNote, setEditingNote] = useState('')

  // 查询相关状态
  const [isQuerying, setIsQuerying] = useState(false)

  // 网络状态（简化版，主要由API管理器处理）
  const [networkStatus, setNetworkStatus] = useState<"connecting" | "connected" | "error">("connected")
  const [bnbPrice, setBnbPrice] = useState(600) // BNB/USDT价格

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

  // 初始化配置管理器
  useEffect(() => {
    const initializeManagers = async () => {
      try {
        LogManager.addLog('系统', '初始化配置管理器...')
        await configManager.initialize()
        LogManager.addLog('系统', '管理器初始化完成')
      } catch (error) {
        LogManager.addLog('错误', `管理器初始化失败: ${error}`)
      }
    }

    initializeManagers()
  }, [])

  // 从localStorage恢复钱包数据
  useEffect(() => {
    if (!props.wallets) {
      try {
        const savedWallets = localStorage.getItem('revenue-display-wallets')
        if (savedWallets) {
          const parsedWallets = JSON.parse(savedWallets) as Wallet[]
          setWallets(parsedWallets)
          LogManager.addLog('系统', `从localStorage恢复了 ${parsedWallets.length} 个钱包`)
        }
      } catch (error) {
        LogManager.addLog('错误', `读取钱包数据失败: ${error}`)
      }
    }
  }, [props.wallets, setWallets])

  // 保存钱包数据到localStorage
  useEffect(() => {
    if (wallets.length > 0 && !props.wallets) {
      try {
        localStorage.setItem('revenue-display-wallets', JSON.stringify(wallets))
        LogManager.addLog('系统', `保存了 ${wallets.length} 个钱包到localStorage`)
      } catch (error) {
        LogManager.addLog('错误', `保存钱包数据失败: ${error}`)
      }
    }
  }, [wallets, props.wallets])

  // 使用真实API查询钱包数据（优化版：使用共享数据）
  const queryWalletDataWithAPI = useCallback(async (
    wallet: Wallet, 
    walletIndex: number,
    sharedData: {
      blockRange: any,
      priceMap: any,
      bnbPrice: number
    }
  ): Promise<WalletData> => {
    try {
      LogManager.addLog('分析', `钱包 ${walletIndex + 1}: 开始API查询（使用共享数据）`)
      
      // 1. 获取代币余额（传递共享的区块范围、BNB价格和价格映射表）
      const balanceService = BalanceService.getInstance()
      const balanceResult = await balanceService.getWalletBalance(wallet.address, selectedDate, {
        blockRange: sharedData.blockRange,
        bnbPrice: sharedData.bnbPrice,
        priceMap: sharedData.priceMap
      })
      
      const tokenBalances = balanceResult.tokenBalances
      const totalBalance = balanceResult.totalUsdValue
      
      LogManager.addLog('余额', `钱包 ${walletIndex + 1}: 余额查询完成 $${totalBalance.toFixed(2)} (使用共享BNB价格)`)

      // 2. 获取交易数据（传递共享的区块范围和价格映射）
      let tradingVolume = 0
      let transactionCount = 0
      let tradingLoss = 0
      let gasLoss = 0
      let transactions: Transaction[] = []

      try {
        const transactionService = TransactionAnalysisService.getInstance()
        
        LogManager.addLog('分析', `钱包 ${walletIndex + 1}: 使用共享区块范围 ${sharedData.blockRange.startBlock}-${sharedData.blockRange.endBlock}`)
        
        // 传递共享的价格映射表
        const analysisResult = await transactionService.analyzeInBlockRange(
          wallet.address, 
          sharedData.blockRange,
          sharedData.priceMap
        )

        // 获取分析结果
        tradingLoss = analysisResult.result.tradingLoss.lossValue || 0
        gasLoss = analysisResult.result.gasLoss.totalGasValue || 0
        tradingVolume = analysisResult.result.validTransactions.volume || 0
        transactionCount = analysisResult.result.validTransactions.count || 0
        
        // 转换交易格式并缓存
        transactions = (analysisResult.result.validTransactions.transactions || []).map((tx: any) => ({
          hash: tx.hash,
          from: wallet.address,
          to: tx.toToken || '',
          value: tx.fromAmount?.toString() || '0',
          tokenSymbol: `${tx.fromToken}→${tx.toToken}`,
          tokenName: `${tx.fromToken} to ${tx.toToken}`,
          gasUsed: tx.gasUsed?.toString() || '0',
          gasPrice: '0',
          blockNumber: tx.blockNumber || 0,
          timestamp: tx.timestamp || 0,
          usdValue: tx.fromAmount || 0,
          fromToken: tx.fromToken,
          toToken: tx.toToken,
          fromAmount: tx.fromAmount,
          toAmount: tx.toAmount
        }))

        LogManager.addLog('交易', `钱包 ${walletIndex + 1}: 交易分析完成 ${transactionCount}笔，$${tradingVolume.toFixed(2)} (使用共享价格映射)`)
        
      } catch (transactionError) {
        LogManager.addLog('错误', `钱包 ${walletIndex + 1}: 交易分析失败: ${transactionError}`)
        // 查询失败就直接抛出错误，不使用模拟数据
        throw transactionError
      }

      // 缓存交易数据
      setWalletTransactionsCache(prev => ({
        ...prev,
        [wallet.address]: transactions
      }))

      // 3. 计算预估积分（BSC链代币使用双倍交易量）
      const balanceForPoints = BalanceService.calculatePointsBalance(tokenBalances)
      const balancePoints = PointsUtils.balance(balanceForPoints)
      
      // 根据app-config.json中的代币配置，当前BSC链代币使用BSC积分计算
      const isBSCTransaction = true // ZKJ, KOGE, USDT都在BSC链上
      const tradingVolumePoints = isBSCTransaction 
        ? PointsUtils.bscTradingVolume(tradingVolume)
        : PointsUtils.tradingVolume(tradingVolume)
      
      const estimatedPoints = balancePoints + tradingVolumePoints

      LogManager.addLog('积分', `钱包 ${walletIndex + 1}: 余额积分${balancePoints} + 交易积分${tradingVolumePoints} = ${estimatedPoints}分`)
      LogManager.addLog('完成', `钱包 ${walletIndex + 1}: API查询完成（共享数据优化生效）`)

      return {
        address: wallet.address,
        note: wallet.note,
        totalBalance,
        tokenBalances,
        tradingVolume,
        transactionCount,
        estimatedPoints,
        revenue: tradingLoss,
        gasUsed: gasLoss,
        tradingLoss,
        gasLoss,
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

  // 批量查询钱包数据（优化版：预先获取共享数据）
  const handleBatchQuery = useCallback(async () => {
    if (wallets.length === 0) return

    const startTime = Date.now()
    const sessionId = `WALLET_BATCH_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}`
    
    LogManager.startSession(sessionId)

    setIsQuerying(true)
    setHasQueried(true)

    // 清除之前的交易缓存
    setWalletTransactionsCache({})
    LogManager.addLog('缓存', '清除交易缓存，重新查询所有钱包数据')

    setWalletData([])

    try {
      LogManager.addLog('共享', '开始获取共享数据...')
      
      // 1. 获取共享的区块范围
      const dayTimeRange = TimeUtils.getDayTimeRange(selectedDate)
      LogManager.addLog('共享', `获取 ${selectedDate} 的区块范围...`)
      
      const startBlock = await TimeUtils.getBlockByTimestamp(dayTimeRange.startTimestamp, 'after', 30)
      const endBlock = await TimeUtils.getBlockByTimestamp(dayTimeRange.endTimestamp, 'before', 30)
      
      const blockRange = {
        startBlock,
        endBlock,
        startTimestamp: dayTimeRange.startTimestamp,
        endTimestamp: dayTimeRange.endTimestamp
      }
      
      LogManager.addLog('共享', `区块范围: ${startBlock} - ${endBlock}`)
      
      // 2. 获取共享的代币价格映射（使用第一个钱包的交易数据来推算价格）
      LogManager.addLog('共享', '获取代币价格映射...')
      let priceMap: { [symbol: string]: number } = {}
      
      try {
        // 使用第一个钱包的交易数据来构建价格映射表
        if (wallets.length > 0) {
          const firstWallet = wallets[0]
          LogManager.addLog('共享', `使用钱包 ${firstWallet.address} 的交易数据构建价格映射表...`)
          
          const transactionService = TransactionAnalysisService.getInstance()
          const sampleAnalysis = await transactionService.analyzeInBlockRange(
            firstWallet.address,
            blockRange
          )
          
          const sampleTransactions = sampleAnalysis.result.allExchanges.transactions || []
          LogManager.addLog('共享', `获取到 ${sampleTransactions.length} 笔交易用于价格推算`)
          
          // 转换为TokenPriceUtils需要的格式
          const transactionsForPrice = sampleTransactions.map((tx: any) => ({
            fromToken: tx.fromToken,
            toToken: tx.toToken,
            fromAmount: tx.fromAmount,
            toAmount: tx.toAmount,
            timestamp: tx.timestamp,
            hash: tx.hash
          }))
          
          priceMap = await TokenPriceUtils.buildCompletePriceMap(transactionsForPrice)
          LogManager.addLog('共享', `价格映射完成，包含 ${Object.keys(priceMap).length} 个代币价格`)
        } else {
          LogManager.addLog('共享', '没有钱包数据，使用基础价格映射')
          priceMap = await TokenPriceUtils.buildCompletePriceMap([])
        }
      } catch (error) {
        LogManager.addLog('错误', `价格映射构建失败: ${error}，使用基础价格`)
        priceMap = await TokenPriceUtils.buildCompletePriceMap([])
      }
      
      // 3. 获取BNB价格
      let bnbPrice = 600
      try {
        bnbPrice = await TokenPriceUtils.getCurrentBNBPrice()
        setBnbPrice(bnbPrice)
        LogManager.addLog('共享', `BNB价格: $${bnbPrice}`)
      } catch (error) {
        LogManager.addLog('错误', `BNB价格获取失败，使用默认价格: $${bnbPrice}`)
      }
      
      // 组装共享数据
      const sharedData = {
        blockRange,
        priceMap,
        bnbPrice
      }
      
      LogManager.addLog('共享', '所有共享数据获取完成！')
      LogManager.logWalletQueryStart(wallets.length, selectedDate)

      const results: WalletData[] = new Array(wallets.length)
      
      // 保守的并发控制
      const maxConcurrency = 3
      LogManager.addLog('并发', `并发数设置: ${maxConcurrency}`)

      // 创建所有查询任务（传递共享数据）
      const queryTasks = wallets.map((wallet, index) => async () => {
        try {
          LogManager.addLog('查询', `API查询 ${index + 1}/${wallets.length}: ${wallet.address}`)
          const result = await queryWalletDataWithAPI(wallet, index, sharedData)
          results[index] = result
          
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

      // 并发控制执行
      const executing: Promise<void>[] = []
      let taskIndex = 0

      for (let i = 0; i < Math.min(maxConcurrency, queryTasks.length); i++) {
        if (taskIndex < queryTasks.length) {
          const task = queryTasks[taskIndex++]
          executing.push(
            task().then(() => {
              if (taskIndex < queryTasks.length) {
                const nextTask = queryTasks[taskIndex++]
                return nextTask()
              }
            })
          )
        }
      }

      await Promise.allSettled(executing)
      
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

      const endTime = Date.now()
      const totalTime = (endTime - startTime) / 1000

      LogManager.logBatchSummary(results.filter(result => result !== undefined))
      
      LogManager.logPerformanceStats({
        totalTime,
        apiCalls: wallets.length,
        cacheMisses: 0,
        cacheHits: 0
      })

      LogManager.addLog('界面', '所有查询完成，更新UI显示数据')
      setWalletData(results.filter(result => result !== undefined))
      
    } catch (error) {
      LogManager.addLog('错误', `批量查询发生错误: ${error}`)
    } finally {
      setIsQuerying(false)
      await LogManager.endSession()
    }
  }, [wallets, selectedDate, queryWalletDataWithAPI, setWalletData, setHasQueried, setWalletTransactionsCache])

  // 查看交易详情
  const handleViewTransactions = useCallback(async (address: string) => {
    setSelectedWalletAddress(address)
    setTransactionModalOpen(true)
    setIsLoadingTransactions(true)

    try {
      const cachedTransactions = walletTransactionsCache[address]
      if (cachedTransactions) {
        LogManager.addLog('缓存', `使用缓存的交易数据，共 ${cachedTransactions.length} 笔有效交易`)
        setSelectedWalletTransactions(cachedTransactions)
        setIsLoadingTransactions(false)
        return
      }

      LogManager.addLog('提示', `该钱包还没有交易缓存，请先进行批量查询`)
      setSelectedWalletTransactions([])
      setIsLoadingTransactions(false)
    } catch (error) {
      LogManager.addLog('错误', `获取交易详情失败: ${error}`)
      setSelectedWalletTransactions([])
      setIsLoadingTransactions(false)
    }
  }, [walletTransactionsCache])

  // 重试单个钱包
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
      
      // 优化：重试时也使用共享数据，避免重复查询
      LogManager.addLog('重试', '构建重试用的共享数据...')
      
      const dayTimeRange = TimeUtils.getDayTimeRange(selectedDate)
      const startBlock = await TimeUtils.getBlockByTimestamp(dayTimeRange.startTimestamp, 'after', 30)
      const endBlock = await TimeUtils.getBlockByTimestamp(dayTimeRange.endTimestamp, 'before', 30)
      
      const blockRange = {
        startBlock, 
        endBlock, 
        startTimestamp: dayTimeRange.startTimestamp, 
        endTimestamp: dayTimeRange.endTimestamp
      }
      
      const priceMap = await TokenPriceUtils.buildCompletePriceMap([])
      
      const tempSharedData = {
        blockRange,
        priceMap,
        bnbPrice
      }
      
      LogManager.addLog('重试', `使用共享数据重试: 区块${startBlock}-${endBlock}, BNB价格$${bnbPrice}, 价格映射${Object.keys(priceMap).length}个代币`)
      
      const result = await queryWalletDataWithAPI(wallet, walletIndex, tempSharedData)
      
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
  }, [wallets, queryWalletDataWithAPI, setWalletData, setWalletTransactionsCache, selectedDate, bnbPrice])



  // 新增的导入钱包逻辑
  const handleImportWallets = useCallback(() => {
    if (!walletInput.trim()) return
    
    const lines = walletInput.trim().split('\n').filter(line => line.trim())
    const newWallets: Wallet[] = []
    let validCount = 0
    let duplicateCount = 0
    let invalidCount = 0

    lines.forEach(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return

      let address: string
      let note: string

      if (trimmedLine.includes(',')) {
        const parts = trimmedLine.split(',')
        address = parts[0].trim()
        note = parts.slice(1).join(',').trim()
      } else {
        address = trimmedLine
        note = `钱包${wallets.length + newWallets.length + 1}`
      }

      // 简单的地址验证
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        invalidCount++
        return
      }

      const isDuplicate = wallets.some(w => w.address.toLowerCase() === address.toLowerCase()) ||
                         newWallets.some(w => w.address.toLowerCase() === address.toLowerCase())

      if (isDuplicate) {
        duplicateCount++
        return
      }

      newWallets.push({ address, note: note || `钱包${wallets.length + newWallets.length + 1}` })
      validCount++
    })

    if (newWallets.length > 0) {
      setWallets([...wallets, ...newWallets])
    }

    let message = `成功导入 ${validCount} 个钱包`
    if (duplicateCount > 0) message += `，跳过 ${duplicateCount} 个重复地址`
    if (invalidCount > 0) message += `，忽略 ${invalidCount} 个无效地址`
    showToast(message, 'success', '导入完成')

    setWalletInput("")
    setWalletModalOpen(false)
  }, [wallets, walletInput, setWallets])

  // 新增的批量删除钱包逻辑
  const handleBatchDelete = useCallback(() => {
    if (selectedWallets.length === 0) return
    
    showConfirm(
      '批量删除钱包',
      `确定要删除选中的 ${selectedWallets.length} 个钱包吗？删除后无法恢复。`,
      () => {
        setWallets(wallets.filter(w => !selectedWallets.includes(w.address)))
        setSelectedWallets([])
        showToast(`已删除 ${selectedWallets.length} 个钱包`, 'success')
      },
      { type: 'danger', confirmText: '删除', cancelText: '取消' }
    )
  }, [wallets, selectedWallets, setWallets, showConfirm, showToast])

  // 新增的选择所有钱包逻辑
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedWallets(wallets.map(w => w.address))
    } else {
      setSelectedWallets([])
    }
  }, [wallets])

  // 新增的选择单个钱包逻辑
  const handleSelectWallet = useCallback((address: string, checked: boolean) => {
    if (checked) {
      setSelectedWallets(prev => [...prev, address])
    } else {
      setSelectedWallets(prev => prev.filter(addr => addr !== address))
    }
  }, [])

  // 新增的编辑钱包逻辑
  const handleEditWallet = useCallback((wallet: Wallet) => {
    setEditingWallet(wallet.address)
    setEditingAddress(wallet.address)
    setEditingNote(wallet.note)
  }, [])

  // 新增的移除钱包逻辑
  const handleRemoveWallet = useCallback((address: string) => {
    const wallet = wallets.find(w => w.address === address)
    const walletName = wallet?.note && wallet.note !== '-' ? wallet.note : `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    
    showConfirm(
      '删除钱包',
      `确定要删除钱包「${walletName}」吗？删除后无法恢复。`,
      () => {
        setWallets(wallets.filter(w => w.address !== address))
        setSelectedWallets(selectedWallets.filter(addr => addr !== address))
        showToast('钱包已删除', 'success')
      },
      { type: 'danger', confirmText: '删除', cancelText: '取消' }
    )
  }, [wallets, selectedWallets, setWallets, showConfirm, showToast])

  // 新增的保存编辑逻辑
  const handleSaveEdit = useCallback(() => {
    if (!editingWallet || !editingAddress.trim()) return

    // 简单的地址验证
    if (!/^0x[a-fA-F0-9]{40}$/.test(editingAddress.trim())) {
      showToast("钱包地址格式不正确，请输入有效的以太坊地址", 'error', '格式错误')
      return
    }

    const trimmedAddress = editingAddress.trim()
    const trimmedNote = editingNote.trim() || '-'

    // 检查是否与其他钱包地址重复
    const isDuplicate = wallets.some(
      (wallet) => wallet.address !== editingWallet && wallet.address === trimmedAddress
    )

    if (isDuplicate) {
      showToast("该地址已被其他钱包使用，请输入不同的地址", 'error', '地址重复')
      return
    }

    setWallets(wallets.map(wallet =>
      wallet.address === editingWallet
        ? { address: trimmedAddress, note: trimmedNote }
        : wallet
    ))

    setEditingWallet(null)
    setEditingAddress('')
    setEditingNote('')
    showToast('钱包信息已保存', 'success')
  }, [editingWallet, editingAddress, editingNote, wallets, setWallets, showToast])

  // 新增的取消编辑逻辑
  const handleCancelEdit = useCallback(() => {
    setEditingWallet(null)
    setEditingAddress('')
    setEditingNote('')
  }, [])

  // 复制地址功能优化
  const copyToClipboard = useCallback(async (text: string, event?: React.MouseEvent) => {
    try {
      // 获取按钮位置
      let position = { x: 0, y: 0 }
      if (event && event.currentTarget) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        position = {
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        }
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        LogManager.addLog('操作', `地址已复制到剪贴板: ${text.substring(0, 10)}...`)
        
        setCopyToast({
          show: true,
          message: '已复制',
          type: 'success',
          position
        })
        setTimeout(() => {
          setCopyToast(prev => ({ ...prev, show: false }))
        }, 2000)
      } else {
        // 降级方案
        const textArea = document.createElement("textarea")
        textArea.value = text
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const success = document.execCommand("copy")
        document.body.removeChild(textArea)
        
        if (success) {
          LogManager.addLog('操作', `地址已复制到剪贴板(降级方案): ${text.substring(0, 10)}...`)
          setCopyToast({
            show: true,
            message: '已复制',
            type: 'success',
            position
          })
          setTimeout(() => {
            setCopyToast(prev => ({ ...prev, show: false }))
          }, 2000)
        } else {
          throw new Error('降级复制方案失败')
        }
      }
    } catch (err) {
      LogManager.addLog('错误', `复制失败: ${err}`)
      
      let position = { x: 0, y: 0 }
      if (event && event.currentTarget) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        position = {
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        }
      }
      
      setCopyToast({
        show: true,
        message: '复制失败',
        type: 'error',
        position
      })
      setTimeout(() => {
        setCopyToast(prev => ({ ...prev, show: false }))
      }, 2000)
      
      // 显示复制失败的详细信息弹窗
      setTimeout(() => {
        showConfirm(
          '复制失败',
          '无法自动复制到剪贴板，请手动复制下面的地址：',
          () => {},
          { 
            confirmText: '我已复制', 
            cancelText: '关闭',
            type: 'info'
          }
        )
        // 同时在确认对话框中显示完整地址，这里暂时用toast代替
        showToast(`地址：${text}`, 'info', '请手动复制')
      }, 100)
    }
  }, [])

  // 截断地址显示
  const truncateAddress = useCallback((address: string) => {
    if (address.length <= 10) return address
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }, [])

  // 计算总计数据
  const totalStats = useMemo(() => {
    return {
      totalTransactions: walletData.reduce((sum, wallet) => sum + wallet.transactionCount, 0),
      totalVolume: walletData.reduce((sum, wallet) => sum + wallet.tradingVolume, 0),
      totalRevenue: walletData.reduce((sum, wallet) => sum + (wallet.tradingLoss || wallet.revenue) + (wallet.gasLoss || wallet.gasUsed), 0),
      totalPoints: walletData.reduce((sum, wallet) => sum + wallet.estimatedPoints, 0),
      totalBalance: walletData.reduce((sum, wallet) => sum + wallet.totalBalance, 0),
      totalGasUsed: walletData.reduce((sum, wallet) => sum + (wallet.gasLoss || wallet.gasUsed), 0),
      totalTradingLoss: walletData.reduce((sum, wallet) => sum + (wallet.tradingLoss || wallet.revenue), 0),
      totalGasLoss: walletData.reduce((sum, wallet) => sum + (wallet.gasLoss || wallet.gasUsed), 0),
    }
  }, [walletData])

  // 过滤钱包数据
  const filteredWallets = useMemo(() => {
    return walletData.filter(
      (wallet) =>
        wallet.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wallet.note.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [walletData, searchQuery])

  // 排序功能
  const handleSort = useCallback((sortType: string) => {
    if (sortBy === sortType) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortBy(sortType)
      setSortDirection("desc")
    }
  }, [sortBy, sortDirection])

  // 排序后的钱包数据
  const sortedWallets = useMemo(() => {
    return [...filteredWallets].sort((a, b) => {
      let comparison = 0

      if (sortBy === "volume") {
        comparison = a.tradingVolume - b.tradingVolume
      } else if (sortBy === "points") {
        comparison = a.estimatedPoints - b.estimatedPoints
      } else if (sortBy === "revenue") {
        comparison = (a.tradingLoss || a.revenue) + (a.gasLoss || a.gasUsed) - 
                     ((b.tradingLoss || b.revenue) + (b.gasLoss || b.gasUsed))
      } else if (sortBy === "balance") {
        comparison = a.totalBalance - b.totalBalance
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [filteredWallets, sortBy, sortDirection])

  // 网络状态badge
  const getNetworkStatusBadge = useCallback(() => {
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
  }, [networkStatus])

  // 日期变更处理
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
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
                  <div className="text-xl font-normal text-green-600">
                    ${totalStats.totalBalance.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">有效交易次数</div>
                  <div className="text-xl font-normal">
                    {totalStats.totalTransactions}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">交易额</div>
                  <div className="text-xl font-normal text-blue-600">
                    ${totalStats.totalVolume.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">总磨损(USDT)</div>
                  <div className="text-xl font-normal text-red-500">
                    ${totalStats.totalRevenue.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">预估总积分</div>
                  <div className="text-xl font-normal text-purple-600">
                    {totalStats.totalPoints}分
                  </div>
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
                                    copyToClipboard(wallet.address, e)
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
                              <span className="text-green-600 font-normal">
                                ${wallet.totalBalance.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-blue-600 font-normal">${wallet.tradingVolume.toFixed(2)}</span>
                            </td>
                            <td className="py-3 px-4 font-light">{wallet.transactionCount}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-purple-600 font-normal text-lg">{wallet.estimatedPoints}分</span>
                                <div className="text-xs text-gray-500 mt-1">
                                  <div>余额积分: {PointsUtils.balance(wallet.totalBalance)}分</div>
                                  <div>交易积分: {PointsUtils.bscTradingVolume(wallet.tradingVolume)}分</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-red-500 font-normal">${((wallet.tradingLoss || wallet.revenue) + (wallet.gasLoss || wallet.gasUsed)).toFixed(2)}</span>
                                <div className="text-xs text-gray-500 mt-1">
                                  <div>交易磨损: ${(wallet.tradingLoss || wallet.revenue).toFixed(2)}</div>
                                  <div>Gas磨损: ${(wallet.gasLoss || wallet.gasUsed).toFixed(2)}</div>
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
                                  onClick={() => handleViewTransactions(wallet.address)}
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
                              copyToClipboard(wallet.address, e)
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
                              ${wallet.totalBalance.toFixed(2)}
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
                              <div>余额: {PointsUtils.balance(wallet.totalBalance)}分</div>
                              <div>交易: {PointsUtils.bscTradingVolume(wallet.tradingVolume)}分 (BSC)</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 font-light">磨损明细</div>
                            <div className="text-red-500 font-normal">${((wallet.tradingLoss || wallet.revenue) + (wallet.gasLoss || wallet.gasUsed)).toFixed(2)}</div>
                            <div className="text-xs text-gray-500">
                              <div>交易磨损: ${(wallet.tradingLoss || wallet.revenue).toFixed(2)}</div>
                              <div>Gas磨损: ${(wallet.gasLoss || wallet.gasUsed).toFixed(2)}</div>
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
                            onClick={() => handleViewTransactions(wallet.address)}
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
                            {editingWallet === wallet.address ? (
                              <Input
                                value={editingAddress}
                                onChange={(e) => setEditingAddress(e.target.value)}
                                className="font-mono text-sm"
                                placeholder="钱包地址"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-light">{truncateAddress(wallet.address)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-blue-100"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    copyToClipboard(wallet.address, e)
                                  }}
                                  title="复制完整地址"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {editingWallet === wallet.address ? (
                              <Input
                                value={editingNote}
                                onChange={(e) => setEditingNote(e.target.value)}
                                className="text-sm"
                                placeholder="备注"
                              />
                            ) : (
                              <span className="font-light">{wallet.note}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {editingWallet === wallet.address ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-green-100 text-green-600"
                                  onClick={handleSaveEdit}
                                  title="保存"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-600"
                                  onClick={handleCancelEdit}
                                  title="取消"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-blue-100 text-blue-600"
                                  onClick={() => handleEditWallet(wallet)}
                                  title="编辑"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-red-100 text-red-600"
                                  onClick={() => handleRemoveWallet(wallet.address)}
                                  title="删除钱包"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
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

        <APIConfigPanel
          open={apiConfigOpen}
          onOpenChange={setApiConfigOpen}
        />

        {/* 通用Toast提示 */}
        {toast.show && (
          <div className="fixed top-4 right-4 z-[9999] max-w-md animate-in slide-in-from-right-full duration-300">
            <div className={`rounded-lg shadow-lg border-l-4 p-4 ${
              toast.type === 'success' ? 'bg-green-50 border-green-400' :
              toast.type === 'error' ? 'bg-red-50 border-red-400' :
              toast.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
              'bg-blue-50 border-blue-400'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {toast.type === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  {toast.type === 'warning' && (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  {toast.type === 'info' && (
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  {toast.title && (
                    <h3 className={`text-sm font-medium ${
                      toast.type === 'success' ? 'text-green-800' :
                      toast.type === 'error' ? 'text-red-800' :
                      toast.type === 'warning' ? 'text-yellow-800' :
                      'text-blue-800'
                    }`}>
                      {toast.title}
                    </h3>
                  )}
                  <p className={`text-sm ${toast.title ? 'mt-1' : ''} ${
                    toast.type === 'success' ? 'text-green-700' :
                    toast.type === 'error' ? 'text-red-700' :
                    toast.type === 'warning' ? 'text-yellow-700' :
                    'text-blue-700'
                  }`}>
                    {toast.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      toast.type === 'success' ? 'text-green-400 hover:bg-green-100 focus:ring-green-600' :
                      toast.type === 'error' ? 'text-red-400 hover:bg-red-100 focus:ring-red-600' :
                      toast.type === 'warning' ? 'text-yellow-400 hover:bg-yellow-100 focus:ring-yellow-600' :
                      'text-blue-400 hover:bg-blue-100 focus:ring-blue-600'
                    }`}
                    onClick={() => setToast(prev => ({ ...prev, show: false }))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 确认对话框 */}
        <Dialog open={confirmDialog.show} onOpenChange={(open) => {
          if (!open) {
            confirmDialog.onCancel?.()
            setConfirmDialog(prev => ({ ...prev, show: false }))
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {confirmDialog.type === 'danger' && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                {confirmDialog.type === 'warning' && (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                {confirmDialog.type === 'info' && (
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                )}
                {confirmDialog.title}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  confirmDialog.onCancel?.()
                  setConfirmDialog(prev => ({ ...prev, show: false }))
                }}
              >
                {confirmDialog.cancelText}
              </Button>
              <Button
                variant={confirmDialog.type === 'danger' ? 'destructive' : 'default'}
                onClick={confirmDialog.onConfirm}
                className={
                  confirmDialog.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  confirmDialog.type === 'info' ? 'bg-blue-600 hover:bg-blue-700' : ''
                }
              >
                {confirmDialog.confirmText}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 复制成功/失败提示 */}
        {copyToast.show && (
          <div 
            className={`fixed z-[9999] px-3 py-2 rounded-md shadow-lg text-white text-sm font-medium transition-all duration-300 pointer-events-none ${
              copyToast.type === 'success' 
                ? 'bg-green-500' 
                : 'bg-red-500'
            }`}
            style={{
              left: `${copyToast.position.x}px`,
              top: `${copyToast.position.y}px`,
              transform: 'translateX(-50%)',
              animation: 'fadeInUp 0.2s ease-out'
            }}
          >
            <div className="flex items-center gap-1">
              {copyToast.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{copyToast.message}</span>
            </div>
            {/* 小箭头 */}
            <div 
              className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${
                copyToast.type === 'success' 
                  ? 'border-t-green-500' 
                  : 'border-t-red-500'
              }`}
            />
          </div>
        )}
      </div>
    </div>
  )
} 