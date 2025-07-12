"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, X, ArrowUpDown, Loader2, AlertCircle, Settings, CheckCircle, ExternalLink, Edit2, Save, XCircle, Eye, EyeOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useLogger } from "@/lib/core/logger"

// 导入统一的类型定义
import type {
  Wallet,
  WalletData,
  AnalyzeResponse,
  RevenueDisplayProps
} from '@/types'

export function RevenueDisplay(props: RevenueDisplayProps = {}) {
  // 日志系统
  const logger = useLogger()

  // 使用当前日期作为默认值（UTC时间）
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
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
  
  // Toast状态
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
  }>({ show: false, message: '', type: 'info' })
  
  // 编辑状态
  const [editingWallet, setEditingWallet] = useState<string | null>(null)
  const [editingAddress, setEditingAddress] = useState('')
  const [editingNote, setEditingNote] = useState('')

  // 查询相关状态
  const [isQuerying, setIsQuerying] = useState(false)
  
  // 弹窗状态
  const [rulesModalOpen, setRulesModalOpen] = useState(false)



  // 交易详情相关状态
  const [selectedWalletAddress, setSelectedWalletAddress] = useState('')
  const [selectedWalletTransactions, setSelectedWalletTransactions] = useState<Array<{
    transactionHash: string
    pairLabel: string
    buySymbol: string
    sellSymbol: string
    buyAmount: string
    sellAmount: string
    time: string
    blockNumber: number
    totalValueUsd: number
  }>>([])
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)

  // Toast显示函数
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    setToast({ show: true, message, type, title })
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 4000)
  }, [])

  // 从localStorage恢复钱包数据
  useEffect(() => {
    if (!props.wallets) {
      try {
        const savedWallets = localStorage.getItem('revenue-display-wallets')
        if (savedWallets) {
          const parsedWallets = JSON.parse(savedWallets) as Wallet[]
          setWallets(parsedWallets)
          logger.info('localStorage', `恢复了 ${parsedWallets.length} 个钱包`)
        }
      } catch (error) {
        logger.error('localStorage', `读取钱包数据失败: ${error}`)
      }
    }
  }, [props.wallets, setWallets])

  // 保存钱包数据到localStorage
  useEffect(() => {
    if (wallets.length > 0 && !props.wallets) {
      try {
        localStorage.setItem('revenue-display-wallets', JSON.stringify(wallets))
        logger.info('localStorage', `保存了 ${wallets.length} 个钱包`)
      } catch (error) {
        logger.error('localStorage', `保存钱包数据失败: ${error}`)
      }
    }
  }, [wallets, props.wallets])

  // 批量查询钱包数据 - 使用新的后端 API
  const handleBatchQuery = useCallback(async () => {
    if (wallets.length === 0) return

    const startTime = Date.now()
    setIsQuerying(true)
    setHasQueried(true)
    setWalletData([])

    // 启动日志会话
    const sessionId = `钱包分析_${selectedDate}`
    logger.startSession(sessionId)

    logger.debug('batch-query', `🚀 开始查询 ${wallets.length} 个钱包，日期: ${selectedDate}`)
    logger.debug('batch-query', `📋 钱包列表`, wallets.map((w, i) => `${i+1}. ${w.address} (${w.note})`))

    logger.info('batch-query', `开始查询 ${wallets.length} 个钱包，日期: ${selectedDate}`)

    try {
      logger.debug('api-request', `📡 发送请求到 /api/revenue/analyze...`)

      // 调用后端 API
      const response = await fetch('/api/revenue/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddresses: wallets.map(w => w.address),
          date: selectedDate,
          config: {
            batchSize: 10,
            concurrency: 30,
            retryAttempts: 3
          }
        })
      })

      logger.debug('api-response', `📡 收到响应，状态: ${response.status}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: AnalyzeResponse = await response.json()
      logger.debug('api-response', `📊 解析响应数据`, result)

      if (!result.success) {
        throw new Error(result.error || '未知错误')
      }

      if (!result.data) {
        throw new Error('API 返回数据为空')
      }

      logger.debug('data-processing', `📈 处理查询结果: ${result.data.wallets.length} 个钱包`)

      // 合并钱包备注信息
      const walletDataWithNotes: WalletData[] = result.data.wallets.map((walletResult, index) => {
        const wallet = wallets[index]
        const mergedData = {
          ...walletResult,
          // 保持原有的备注信息
          note: wallet?.note || `钱包${index + 1}`
        }

        logger.debug('wallet-result', `💰 钱包 ${index + 1} (${wallet.address}): 余额=$${walletResult.tokensValue.toFixed(2)}, 积分=${walletResult.points}, ${walletResult.error ? '❌错误: ' + walletResult.error : '✅成功'}`)

        return mergedData
      })

      setWalletData(walletDataWithNotes)

      const endTime = Date.now()
      const totalTime = (endTime - startTime) / 1000
      const { summary } = result.data

      logger.debug('batch-complete', `✅ 查询完成: ${summary.successCount}成功, ${summary.errorCount}失败, 耗时${totalTime.toFixed(1)}s`)
      logger.debug('batch-summary', `📊 汇总统计`, {
        总钱包数: summary.totalWallets,
        成功数: summary.successCount,
        失败数: summary.errorCount,
        总余额: `$${summary.totalBalance.toFixed(2)}`,
        总交易额: `$${summary.totalVolume.toFixed(2)}`,
        总积分: summary.totalPoints,
        处理时间: `${summary.processingTime.toFixed(1)}s`
      })

      logger.info('batch-query', `查询完成: ${summary.successCount}成功, ${summary.errorCount}失败, 总价值$${summary.totalBalance.toFixed(2)}, 耗时${totalTime.toFixed(1)}s`)

      showToast(
        `查询完成: ${summary.successCount}个成功, ${summary.errorCount}个失败`,
        summary.errorCount > 0 ? 'warning' : 'success',
        `批量查询结果 (${totalTime.toFixed(1)}s)`
      )

    } catch (error) {
      logger.error('batch-query', `❌ 批量查询失败: ${error}`)
      showToast(
        error instanceof Error ? error.message : '网络请求失败',
        'error',
        '批量查询失败'
      )
    } finally {
      setIsQuerying(false)

      // 结束日志会话
      await logger.endSession()
    }
  }, [wallets, selectedDate, setWalletData, setHasQueried, showToast])

  // 重试单个钱包 - 使用后端 API
  const handleRetryWallet = useCallback(async (walletAddress: string) => {
    const wallet = wallets.find(w => w.address === walletAddress)
    if (!wallet) return

    // 更新该钱包状态为加载中
    setWalletData(prev => prev.map(w =>
      w.address === walletAddress
        ? { ...w, error: undefined }
        : w
    ))

    try {
      console.log(`🔄 重试查询钱包: ${walletAddress}`)

      // 调用后端 API 重试单个钱包
      const response = await fetch('/api/revenue/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddresses: [walletAddress],
          date: selectedDate,
          config: {
            batchSize: 1,
            concurrency: 1,
            retryAttempts: 3
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: AnalyzeResponse = await response.json()

      if (!result.success || !result.data || result.data.wallets.length === 0) {
        throw new Error(result.error || '重试失败')
      }

      const walletResult = result.data.wallets[0]

      // 更新该钱包的数据，保持备注信息
      setWalletData(prev => prev.map(w =>
        w.address === walletAddress
          ? { ...walletResult, note: wallet.note }
          : w
      ))

      console.log(`✅ 重试成功: ${walletAddress}`)
      showToast('重试成功', 'success')

    } catch (error) {
      console.error(`❌ 重试失败: ${error}`)

      // 更新为错误状态
      setWalletData(prev => prev.map(w =>
        w.address === walletAddress
          ? {
              ...w,
              error: error instanceof Error ? error.message : '重试失败'
            }
          : w
      ))

      showToast('重试失败', 'error')
    }
  }, [wallets, selectedDate, showToast])

  // 导入钱包逻辑
  const handleImportWallets = useCallback(() => {
    if (!walletInput.trim()) return
    
    const lines = walletInput.trim().split('\n').filter(line => line.trim())
    const newWallets: Wallet[] = []
    let validCount = 0
    let duplicateCount = 0
    let invalidCount = 0

    lines.forEach((line, index) => {
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

      // 地址验证
      if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
        invalidCount++
        logger.warn('wallet-validation', `第${index + 1}行地址格式无效: ${address}`)
        return
      }

      const isDuplicate = wallets.some(w => w.address.toLowerCase() === address.toLowerCase()) ||
                         newWallets.some(w => w.address.toLowerCase() === address.toLowerCase())

      if (isDuplicate) {
        duplicateCount++
        logger.warn('wallet-validation', `第${index + 1}行地址重复: ${address}`)
        return
      }

      newWallets.push({ address: address.toLowerCase(), note: note || `钱包${wallets.length + newWallets.length + 1}` })
      validCount++
    })

    if (newWallets.length > 0) {
      setWallets([...wallets, ...newWallets])
      setWalletInput("")
      setWalletModalOpen(false)
    }

    let message = `成功导入 ${validCount} 个钱包`
    if (duplicateCount > 0) message += `，跳过 ${duplicateCount} 个重复地址`
    if (invalidCount > 0) message += `，忽略 ${invalidCount} 个无效地址`

    showToast(message, validCount > 0 ? 'success' : 'warning')
    logger.info('wallet-import', `导入: ${message}`)
  }, [walletInput, wallets, setWallets, showToast])

  // 删除钱包
  const handleDeleteWallet = useCallback((address: string) => {
    setWallets(prev => prev.filter(w => w.address !== address))
    setWalletData(prev => prev.filter(w => w.address !== address))
    showToast('钱包已删除', 'info')
  }, [setWallets, setWalletData, showToast])

  // 开始编辑钱包
  const startEditWallet = useCallback((wallet: Wallet) => {
    setEditingWallet(wallet.address)
    setEditingAddress(wallet.address)
    setEditingNote(wallet.note)
  }, [])

  // 保存编辑的钱包
  const saveEditWallet = useCallback(() => {
    if (!editingWallet) return

    setWallets(prev => prev.map(w => 
      w.address === editingWallet 
        ? { address: editingAddress, note: editingNote }
        : w
    ))

    setWalletData(prev => prev.map(w =>
      w.address === editingWallet
        ? { ...w, address: editingAddress, note: editingNote }
        : w
    ))

    setEditingWallet(null)
    setEditingAddress('')
    setEditingNote('')
    showToast('钱包信息已更新', 'success')
  }, [editingWallet, editingAddress, editingNote, setWallets, setWalletData, showToast])

  // 取消编辑
  const cancelEditWallet = useCallback(() => {
    setEditingWallet(null)
    setEditingAddress('')
    setEditingNote('')
  }, [])

  // 复制地址到剪贴板（和旧文件一样的功能）
  const copyToClipboard = useCallback(async (text: string, event?: React.MouseEvent) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        showToast('地址已复制', 'success')
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
          showToast('地址已复制', 'success')
        } else {
          throw new Error('降级复制方案失败')
        }
      }
    } catch (err) {
      showToast('复制失败', 'error')
    }
  }, [showToast])

  // 截断地址显示
  const truncateAddress = useCallback((address: string) => {
    if (address.length <= 10) return address
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }, [])

  // 复制地址（简化版，兼容性）
  const copyAddress = useCallback((address: string) => {
    copyToClipboard(address)
  }, [copyToClipboard])

  // 查看交易详情
  const handleViewTransactions = useCallback((address: string) => {
    const wallet = walletData.find(w => w.address === address)
    if (!wallet || !wallet.transactionData?.buyTransactions) {
      showToast('无有效交易数据', 'warning')
      return
    }

    // 设置选中的钱包地址和交易数据
    setSelectedWalletAddress(address)
    setSelectedWalletTransactions(wallet.transactionData.buyTransactions.map(tx => ({
      ...tx,
      buySymbol: tx.pairLabel.split('/')[0],
      sellSymbol: tx.pairLabel.split('/')[1]
    })))
    setTransactionModalOpen(true)
  }, [walletData, showToast])

  // 计算总计数据
  const totalStats = useMemo(() => {
    return {
      totalBalance: walletData.reduce((sum, wallet) => sum + wallet.tokensValue, 0),
      totalPoints: walletData.reduce((sum, wallet) => sum + wallet.points, 0),
      totalTokenTypes: 0  // 移除token类型统计，因为我们不再需要它
    }
  }, [walletData])

  // 过滤钱包数据
  const filteredWallets = useMemo(() => {
    return walletData.filter(
      (wallet) =>
        wallet.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (wallet.note || '').toLowerCase().includes(searchQuery.toLowerCase())
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
        comparison = (a.transactionData?.totalBoughtValue || 0) - (b.transactionData?.totalBoughtValue || 0)
      } else if (sortBy === "points") {
        comparison = a.points - b.points
      } else if (sortBy === "loss") {
        comparison = (a.transactionData?.allTransactionLossValue || 0) - (b.transactionData?.allTransactionLossValue || 0)
      } else if (sortBy === "balance") {
        comparison = a.tokensValue - b.tokensValue
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [filteredWallets, sortBy, sortDirection])

  // 日期变更处理
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast 组件 */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {toast.title && <h4 className="font-medium mb-1">{toast.title}</h4>}
          <p className="text-sm">{toast.message}</p>
          </div>
      )}

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
            <label className="text-sm font-medium text-gray-700">查询日期 (UTC):</label>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                    {walletData.reduce((sum, w) => sum + (w.transactionData?.buyTransactionsCount || 0), 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">交易额</div>
                  <div className="text-xl font-normal text-blue-600">
                    ${walletData.reduce((sum, w) => sum + (w.transactionData?.totalBoughtValue || 0), 0).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1 font-light">总磨损(USDT)</div>
                  <div className="text-xl font-normal text-red-500">
                    ${walletData.reduce((sum, w) => sum + Math.abs(w.transactionData?.allTransactionLossValue || 0), 0).toFixed(2)}
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
              正在分析 {wallets.length} 个钱包在 {selectedDate} 的余额数据，请稍候
            </p>
            </div>
          </div>
        )}

        {/* 错误显示区域 */}
        {!isQuerying && walletData.length > 0 && walletData[0]?.error ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-normal text-red-700 mb-2">查询失败</h3>
              <p className="text-red-600 mb-4">{walletData[0].error}</p>
              <Button
                onClick={handleBatchQuery}
                className="bg-red-500 hover:bg-red-600 text-white font-light"
                disabled={isQuerying}
              >
                重新查询
              </Button>
            </div>
          </div>
        ) : null}

        {/* 数据展示区域 */}
        {!isQuerying && walletData.length > 0 && !walletData[0]?.error ? (
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
                      <SelectItem value="loss">磨损</SelectItem>
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

          {/* 表格视图 */}
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
                            onClick={() => handleSort("loss")}
                          >
                            <div className="flex items-center gap-1">
                              磨损明细 (USDT)
                              <ArrowUpDown className="h-4 w-4" />
                              {sortBy === "loss" && (
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
                            <td className="py-3 px-4 text-sm font-light">{wallet.note || '-'}</td>
                            <td className="py-3 px-4">
                              <span className="text-green-600 font-normal">
                                ${wallet.tokensValue.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-blue-600 font-normal">
                                ${wallet.transactionData?.totalBoughtValue.toFixed(2) || "0.00"}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-light">
                              {wallet.transactionData?.buyTransactionsCount || 0}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-purple-600 font-normal text-lg">{wallet.points || 0}分</span>
                                <div className="text-xs text-gray-500 mt-1">
                                  <div>余额积分: {wallet.balancePoints || 0}分</div>
                                  <div>交易积分: {wallet.volumePoints || 0}分</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-red-500 font-normal">
                                  ${(Math.abs(wallet.transactionData?.allTransactionLossValue || 0) + Math.abs(wallet.transactionData?.allGasLossValue || 0)).toFixed(2)}
                                </span>
                                <div className="text-xs text-gray-500 mt-1">
                                  <div>交易磨损: ${Math.abs(wallet.transactionData?.allTransactionLossValue || 0).toFixed(2)}</div>
                                  <div>Gas磨损: ${Math.abs(wallet.transactionData?.allGasLossValue || 0).toFixed(2)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {wallet.error ? (
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
                        {wallet.note && wallet.note !== "-" && (
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
                              ${wallet.tokensValue.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 font-light">交易额</div>
                            <div className="text-blue-600 font-normal">${wallet.transactionData?.totalBoughtValue.toFixed(2) || "0.00"}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="text-gray-600 font-light">有效交易</div>
                            <div className="font-normal">{wallet.transactionData?.buyTransactionsCount || 0}</div>
                          </div>
                          <div>
                            <div className="text-gray-600 font-light">预估总积分</div>
                            <div className="text-purple-600 font-normal text-lg">{wallet.points || 0}分</div>
                            <div className="text-xs text-gray-500 mt-1">
                              <div>余额: {wallet.balancePoints || 0}分</div>
                              <div>交易: {wallet.volumePoints || 0}分</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 font-light">磨损明细</div>
                            <div className="text-red-500 font-normal">
                              ${(Math.abs(wallet.transactionData?.allTransactionLossValue || 0) + Math.abs(wallet.transactionData?.allGasLossValue || 0)).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              <div>交易磨损: ${Math.abs(wallet.transactionData?.allTransactionLossValue || 0).toFixed(2)}</div>
                              <div>Gas磨损: ${Math.abs(wallet.transactionData?.allGasLossValue || 0).toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        {wallet.error ? (
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
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-light"
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
                ⏰ 当前查询日期: {selectedDate} (每日08:00-次日07:59 UTC+8)
              </p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={handleBatchQuery}
                className="bg-green-500 hover:bg-green-600 text-white font-light"
                disabled={isQuerying}
              >
                批量查询数据
              </Button>
            </div>
          </div>
        ) : !isQuerying && wallets.length === 0 ? (
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
                  {/* 这里可以添加批量操作按钮，但新架构暂时简化 */}
                </div>
              </div>

              {wallets.length > 0 ? (
                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 font-normal text-gray-700">钱包地址</th>
                        <th className="text-left p-3 font-normal text-gray-700">备注</th>
                        <th className="w-20 p-3 font-normal text-gray-700">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallets.map((wallet) => (
                        <tr key={wallet.address} className="border-t hover:bg-gray-50">
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
                              <span className="font-light">{wallet.note || '-'}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {editingWallet === wallet.address ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-green-100 text-green-600"
                                  onClick={saveEditWallet}
                                  title="保存"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-600"
                                  onClick={cancelEditWallet}
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
                                  onClick={() => startEditWallet(wallet)}
                                  title="编辑"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-red-100 text-red-600"
                                  onClick={() => handleDeleteWallet(wallet.address)}
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



        {/* 交易详情弹窗 */}
        <Dialog open={transactionModalOpen} onOpenChange={setTransactionModalOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-normal flex items-center gap-2">
                交易详情 - {truncateAddress(selectedWalletAddress)}
                <span className="text-base text-gray-500 flex items-center">({selectedWalletTransactions.length} 笔有效交易)</span>
              </DialogTitle>
            </DialogHeader>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 font-normal text-gray-700 text-center">交易哈希</th>
                    <th className="p-3 font-normal text-gray-700 text-center">时间</th>
                    <th className="p-3 font-normal text-gray-700 text-center">交易记录</th>
                    <th className="p-3 font-normal text-gray-700 text-center">价值(USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedWalletTransactions.map((tx) => (
                    <tr key={tx.transactionHash} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono text-sm">{truncateAddress(tx.transactionHash)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-blue-100"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              copyToClipboard(tx.transactionHash, e)
                            }}
                            title="复制完整哈希"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <a
                            href={`https://bscscan.com/tx/${tx.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="p-3 font-light text-center">{tx.time}</td>
                      <td className="p-3 font-mono text-sm text-center">
                        {Number(Math.abs(Number(tx.sellAmount))).toFixed(2)} {tx.sellSymbol} → {Number(tx.buyAmount).toFixed(2)} {tx.buySymbol}
                      </td>
                      <td className="p-3 font-mono text-sm text-center">${tx.totalValueUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// 默认导出
export default RevenueDisplay