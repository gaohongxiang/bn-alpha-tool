"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  Copy,
  X,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  Settings,
  Eye,
  EyeOff,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ethers } from "ethers"
import { PointsUtils } from "@/components/points-utils"

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
  totalBalance: number // 总余额USDT
  tokenBalances: TokenBalance[]
  tradingVolume: number
  transactionCount: number
  estimatedPoints: number
  revenue: number
  gasUsed: number
  usdtValueChange: number // USDT价值变化
  historicalBalances?: { [symbol: string]: number } // 最后一笔交易时的历史余额
  lastTransactionTime?: number // 最后一笔交易的时间戳
  firstTransactionBalances?: { [symbol: string]: number } // 第一笔交易前的余额
  lastTransactionBalances?: { [symbol: string]: number } // 最后一笔交易后的余额
  firstTransactionTime?: number // 第一笔交易的时间戳
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

interface NetworkConfig {
  chainId: number
  name: string
  rpcUrls: string[]
  blockExplorerUrls: string[]
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

// BSC网络配置
const BSC_CONFIG: NetworkConfig = {
  chainId: 56,
  name: "BSC Mainnet",
  rpcUrls: [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed2.defibit.io/",
    "https://bsc-dataseed1.binance.org/",
    "https://bsc-dataseed2.binance.org/",
    "https://bsc-dataseed3.binance.org/",
    "https://bsc-dataseed4.binance.org/",
    "https://rpc.ankr.com/bsc",
    "https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3",
  ],
  blockExplorerUrls: ["https://bscscan.com"],
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
}

// BSC链代币配置
const BSC_TOKENS = {
  USDT: {
    address: "0x55d398326f99059fF775485246999027B3197955",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 18,
    chain: "BSC"
  },
  USDC: {
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 18,
    chain: "BSC"
  },
  ZKJ: {
    address: "0xc71b5f631354be6853efe9c3ab6b9590f8302e81",
    symbol: "ZKJ",
    name: "ZKJ Token",
    decimals: 18,
    chain: "BSC"
  },
  KOGE: {
    address: "0xe6DF05CE8C8301223373CF5B969AFCb1498c5528",
    symbol: "KOGE",
    name: "KOGE Token",
    decimals: 18,
    chain: "BSC"
  }
}

// 兼容旧代码的代币地址映射
const COMMON_TOKENS = Object.fromEntries(
  Object.entries(BSC_TOKENS).map(([key, token]) => [key, token.address])
)

// BSCScan API中USDT的代币符号可能显示为不同名称，需要统一处理
const TOKEN_SYMBOL_MAPPING: { [key: string]: string } = {
  "BSC-USD": "USDT",   // BSCScan API中USDT显示为BSC-USD
  "USDT": "USDT",
  "USDC": "USDC", 
  "ZKJ": "ZKJ",
  "KOGE": "KOGE",
  // 注意：伪造代币不映射，直接忽略
}

const COMMON_TOKEN_SYMBOLS = Object.keys(COMMON_TOKENS).map((s) => s.toUpperCase())

// 定义所有可能的交易对（用于识别交易）
const ALL_TRADING_PAIRS = [
  // USDT相关交易对
  { from: "USDT", to: "ZKJ" },
  { from: "ZKJ", to: "USDT" },
  { from: "USDT", to: "KOGE" },
  { from: "KOGE", to: "USDT" },
  // ZKJ和KOGE之间的交易
  { from: "ZKJ", to: "KOGE" },
  { from: "KOGE", to: "ZKJ" },
]

// 定义计算交易量的交易对（根据用户规则）
const VOLUME_COUNTING_PAIRS = [
  { from: "USDT", to: "ZKJ" },    // USDT买入ZKJ - 计算交易量
  { from: "USDT", to: "KOGE" },   // USDT买入KOGE - 计算交易量  
  { from: "ZKJ", to: "KOGE" },    // ZKJ↔KOGE互换 - 计算交易量
  { from: "KOGE", to: "ZKJ" },    // KOGE↔ZKJ互换 - 计算交易量
  // 注意：ZKJ/KOGE → USDT 不计算交易量（只计算Gas）
]

interface RevenueDisplayProps {
  // 可选props，如果不传递则组件自管理状态
}



export function RevenueDisplay(props: RevenueDisplayProps = {}) {
  // 获取北京时间当天日期（按8点分界）
  const getBeiJingToday = () => {
    const now = new Date()
    
    // 直接计算北京时间（UTC+8）
    const utcTime = now.getTime()
    const beijingOffset = 8 * 60 * 60 * 1000 // 8小时毫秒数
    const beijingTime = new Date(utcTime + beijingOffset)
    
    const hour = beijingTime.getUTCHours() // 使用UTC方法避免本地时区影响
    const currentDate = beijingTime.toISOString().split("T")[0]
    
    // 如果当前时间是早上8点之前，则属于前一天
    if (hour < 8) {
      const previousDay = new Date(beijingTime)
      previousDay.setUTCDate(previousDay.getUTCDate() - 1)
      return previousDay.toISOString().split("T")[0]
    } else {
      return currentDate
    }
  }

  // 时间范围说明：每天从早上8点到第二天早上8点算1天
  // 例如：2025-06-08 代表 2025-06-08 08:00:00 ~ 2025-06-09 07:59:59 (UTC+8)

  const [selectedDate, setSelectedDate] = useState(getBeiJingToday())
  const [viewMode, setViewMode] = useState("table")
  const [sortBy, setSortBy] = useState("default")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // 钱包相关状态
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [walletInput, setWalletInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWallets, setSelectedWallets] = useState<string[]>([])
  const [walletData, setWalletData] = useState<WalletData[]>([])

  // 查询相关状态
  const [hasQueried, setHasQueried] = useState(false)
  const [isQuerying, setIsQuerying] = useState(false)

  // 网络配置状态
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [selectedRpcIndex, setSelectedRpcIndex] = useState(0)
  const [customRpcUrl, setCustomRpcUrl] = useState("")
  const [bscscanApiKey, setBscscanApiKey] = useState("U4ZMDNTCZKSMHX2671VGQPF8HRWGEUTE5H")
  const [showApiKey, setShowApiKey] = useState(false)
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null)
  const [networkStatus, setNetworkStatus] = useState<"connecting" | "connected" | "error">("connecting")
  const [bnbPrice, setBnbPrice] = useState(600) // BNB/USDT价格
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  
  // 代币价格缓存
  const [tokenPrices, setTokenPrices] = useState<{ [symbol: string]: number }>({
    'ZKJ': 0, // ZKJ价格，需要从API获取
    'KOGE': 0, // KOGE价格，需要从API获取
  })

  // 交易详情弹窗状态
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [selectedWalletTransactions, setSelectedWalletTransactions] = useState<Transaction[]>([])
  const [selectedWalletAddress, setSelectedWalletAddress] = useState("")
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  
  // 缓存每个钱包的交易数据，避免重复查询
  const [walletTransactionsCache, setWalletTransactionsCache] = useState<{ [address: string]: Transaction[] }>({})
  
  // 规则说明弹窗状态
  const [rulesModalOpen, setRulesModalOpen] = useState(false)

  // 获取实时BNB价格
  const fetchBNBPrice = async () => {
    try {
      setIsLoadingPrice(true)
      console.log(`🌐 开始获取BNB价格...`)
      
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd")
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log(`📊 CoinGecko API响应:`, data)
      
      const price = data.binancecoin?.usd || 600
      setBnbPrice(price)
      
      if (data.binancecoin?.usd) {
        console.log(`✅ BNB价格获取成功: $${price}`)
      } else {
        console.warn(`⚠️ API返回数据异常，使用默认价格: $${price}`)
      }
    } catch (error) {
      console.error("❌ BNB价格获取失败:", error)
      setBnbPrice(600) // 使用默认价格
      console.log(`🔄 使用默认BNB价格: $600`)
    } finally {
      setIsLoadingPrice(false)
    }
  }

  // 初始化时获取BNB价格
  useEffect(() => {
    fetchBNBPrice()
    // 每5分钟更新一次价格
    const interval = setInterval(fetchBNBPrice, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // 钱包持久化 - 从localStorage读取
  useEffect(() => {
    try {
      const savedWallets = localStorage.getItem('revenue-display-wallets')
      if (savedWallets) {
        const parsedWallets = JSON.parse(savedWallets) as Wallet[]
        setWallets(parsedWallets)
        console.log(`从localStorage恢复了 ${parsedWallets.length} 个钱包`)
      }
    } catch (error) {
      console.error('读取钱包数据失败:', error)
    }
  }, [])

  // 钱包持久化 - 保存到localStorage
  useEffect(() => {
    if (wallets.length > 0) {
      try {
        localStorage.setItem('revenue-display-wallets', JSON.stringify(wallets))
        console.log(`保存了 ${wallets.length} 个钱包到localStorage`)
      } catch (error) {
        console.error('保存钱包数据失败:', error)
      }
    }
  }, [wallets])

  // 初始化provider
  const initProvider = async () => {
    try {
      setNetworkStatus("connecting")
      const rpcUrl =
        selectedRpcIndex === BSC_CONFIG.rpcUrls.length ? customRpcUrl : BSC_CONFIG.rpcUrls[selectedRpcIndex]

      if (!rpcUrl) {
        setNetworkStatus("error")
        return
      }

      // 添加超时和重试机制
      const newProvider = new ethers.JsonRpcProvider(rpcUrl, {
        name: "BSC Mainnet",
        chainId: 56,
      })

      // 设置超时时间
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timeout")), 10000) // 10秒超时
      })

      // 测试连接
      await Promise.race([
        newProvider.getBlockNumber(),
        timeoutPromise
      ])

      setProvider(newProvider)
      setNetworkStatus("connected")
      console.log(`Connected to BSC RPC: ${rpcUrl}`)
    } catch (error) {
      console.error("Failed to initialize provider:", error)
      setNetworkStatus("error")
      setProvider(null)
      
      // 如果当前RPC失败，自动尝试下一个
      if (selectedRpcIndex < BSC_CONFIG.rpcUrls.length - 1) {
        console.log("Trying next RPC endpoint...")
        setTimeout(() => {
          setSelectedRpcIndex(prev => prev + 1)
        }, 2000)
      }
    }
  }

  // 手动刷新网络连接
  const handleRefreshNetwork = () => {
    initProvider()
  }

  useEffect(() => {
    initProvider()
  }, [selectedRpcIndex, customRpcUrl])

  // 获取钱包BNB余额
  const getWalletBNBBalance = async (address: string): Promise<number> => {
    if (!provider) throw new Error("Provider not initialized")

    try {
      const balance = await provider.getBalance(address)
      return Number.parseFloat(ethers.formatEther(balance))
    } catch (error) {
      console.error(`Error getting BNB balance for ${address}:`, error)
      throw error
    }
  }

  // 获取代币余额
  const getTokenBalances = async (address: string): Promise<TokenBalance[]> => {
    try {
      const baseUrl = "https://api.bscscan.com/api"
      const balances: TokenBalance[] = []

      // 获取BNB余额
      const bnbBalance = await getWalletBNBBalance(address)
      balances.push({
        symbol: "BNB",
        balance: bnbBalance,
        usdValue: bnbBalance * bnbPrice,
      })

      // 获取BSC链代币余额
      for (const [symbol, tokenConfig] of Object.entries(BSC_TOKENS)) {
        try {
          const response = await fetch(
            `${baseUrl}?module=account&action=tokenbalance&contractaddress=${tokenConfig.address}&address=${address}&tag=latest&apikey=${bscscanApiKey}`,
          )
          const data = await response.json()

          if (data.status === "1" && data.result !== "0") {
            const balance = Number.parseFloat(ethers.formatUnits(data.result, tokenConfig.decimals))
            if (balance > 0) {
              // 这里简化处理，实际应该获取代币的实时价格
              let usdValue = 0
              if (symbol === "USDT" || symbol === "USDC" || symbol === "BUSD") {
                usdValue = balance // 稳定币按1:1计算
              }

              balances.push({
                symbol: `${symbol} (${tokenConfig.chain})`, // 显示链信息
                balance,
                usdValue,
                contractAddress: tokenConfig.address,
              })
            }
          }
        } catch (error) {
          console.error(`Error getting ${symbol} balance on ${tokenConfig.chain}:`, error)
        }

        // 添加延迟避免API限制
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      return balances
    } catch (error) {
      console.error("Error getting token balances:", error)
      return []
    }
  }

  // 使用BSCScan API获取指定日期的交易历史（通过区块范围查询）
  const getTransactionsFromBSCScan = async (
    address: string,
    targetDate: string,
  ): Promise<{
    transactions: Transaction[]
    totalGasUsed: number
    totalVolume: number
    usdtValueChange: number
    gasLossUSDT: number
    lastTransactionTime?: number
    firstTransactionBalances: { [symbol: string]: number }
    lastTransactionBalances: { [symbol: string]: number }
    firstTransactionTime?: number
  }> => {
    // 初始化返回值
    const allTransactions: Transaction[] = []
    let totalGasUsed = 0
    let totalVolume = 0
    let firstUsdtBuyValue = 0     // 第一笔USDT买入交易的USDT价值
    let lastTransactionUsdtValue = 0   // 最后一笔交易的USDT价值
    let usdtValueChange = 0       // USDT价值变化（交易磨损）
    let gasLossUSDT = 0           // Gas磨损（USDT价值）
    let hasFirstUsdtBuy = false   // 是否已经记录第一笔USDT买入交易
    let lastTransactionTime = 0   // 最后一笔交易的时间戳
    let firstTransactionBalances: { [symbol: string]: number } = {} // 第一笔交易前的余额
    let lastTransactionBalances: { [symbol: string]: number } = {}  // 最后一笔交易后的余额
    let firstTransactionTime = 0  // 第一笔交易的时间戳
    let totalTransferAdjustment = 0 // 总转账调整金额（USDT价值）
    
    // 不再需要汇率收集，改用历史价格查询

    try {
      // 将日期转换为UTC+8的8点开始和7:59:59结束的时间戳
      const startDateTime = new Date(`${targetDate}T08:00:00+08:00`)
      const endDateTime = new Date(`${targetDate}T08:00:00+08:00`)
      endDateTime.setDate(endDateTime.getDate() + 1)
      endDateTime.setSeconds(endDateTime.getSeconds() - 1) // 7:59:59

      const now = Date.now()
      // 如果当天还没结束，结束时间用当前时间
      const actualEndTime = Math.min(endDateTime.getTime(), now)

      const startTimestamp = Math.floor(startDateTime.getTime() / 1000)
      const endTimestamp = Math.floor(actualEndTime / 1000)

      console.log(`\n=== 查询钱包 ${address} 在 ${targetDate} 的交易 ===`)
      console.log(`时间范围: ${new Date(startTimestamp * 1000).toLocaleString()} - ${new Date(endTimestamp * 1000).toLocaleString()}`)

      // 获取区块号的函数
      const baseUrl = "https://api.bscscan.com/api"
      const getBlockByTimestamp = async (
        timestamp: number,
        closest: "before" | "after" = "before",
      ): Promise<number> => {
        const response = await fetch(
          `${baseUrl}?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=${closest}&apikey=${bscscanApiKey}`,
        )
        const data = await response.json()
        if (data.status === "1") {
          return Number.parseInt(data.result)
        }
        throw new Error(`Failed to get block number for timestamp ${timestamp}`)
      }

      // 获取开始和结束区块号
      const startBlock = await getBlockByTimestamp(startTimestamp, "after")
      const endBlock = await getBlockByTimestamp(endTimestamp, "before")
      
      console.log(`区块范围: ${startBlock} - ${endBlock}`)

      // 查询ERC20代币交易
      const tokenTxResponse = await fetch(
        `${baseUrl}?module=account&action=tokentx&address=${address}&startblock=${startBlock}&endblock=${endBlock}&page=1&offset=1000&sort=asc&apikey=${bscscanApiKey}`,
      )
      
      if (!tokenTxResponse.ok) {
        console.error("Token transactions API request failed:", tokenTxResponse.status)
        throw new Error(`Token transactions API request failed: ${tokenTxResponse.status}`)
      }

      const tokenTxData = await tokenTxResponse.json()
      console.log(`API响应状态: ${tokenTxData.status}, 消息: ${tokenTxData.message}`)
      
      if (tokenTxData.status === "1") {
        const tokenTransactions = tokenTxData.result || []
        console.log(`找到 ${tokenTransactions.length} 个代币交易`)

        // 按交易哈希分组，分析每笔交易的代币流向
        const transactionGroups = new Map()

        tokenTransactions.forEach((tx: any) => {
          const hash = tx.hash
          if (!transactionGroups.has(hash)) {
            transactionGroups.set(hash, [])
          }
          transactionGroups.get(hash).push(tx)
        })

        console.log(`总共 ${transactionGroups.size} 个独立交易`)

        // 收集所有有效交易哈希（用于Gas计算，包括卖出USDT的交易）
        const allValidTxHashes = new Set<string>()

        console.log(`\n💰 改用历史价格查询，不再依赖当日汇率计算`)

        // 第二遍扫描：分析每个交易组，识别有效的交易对
        transactionGroups.forEach((txGroup, hash) => {
          const walletAddress = address.toLowerCase()
          let fromToken = ""
          let toToken = ""
          let fromAmount = 0
          let toAmount = 0

          console.log(`\n===== 分析交易 ${hash} =====`)
          console.log(`钱包地址: ${walletAddress}`)
          console.log(`交易组包含 ${txGroup.length} 个代币转移:`)
          
          // 第一遍：输出所有交易数据，寻找价值信息
          txGroup.forEach((tx: any, index: number) => {
            // 简化输出，仅显示关键信息
          if (index === 0) {
            console.log(`  代币转移概览: ${txGroup.length}个转移记录`)
          }
          })
          
          // 第二遍：分析整个交易的USDT流动，计算交易价值
          let totalUsdtIn = 0  // 钱包收到的USDT
          let totalUsdtOut = 0 // 钱包发出的USDT
          
          txGroup.forEach((tx: any) => {
            const symbol = (tx.tokenSymbol || "").toUpperCase()
            if (symbol === "USDT" || symbol === "BSC-USD") {
              const decimals = Number.parseInt(tx.tokenDecimal || "18")
              const amount = Number.parseFloat(ethers.formatUnits(tx.value || "0", decimals))
              
                              if (tx.to.toLowerCase() === walletAddress) {
                totalUsdtIn += amount
              } else if (tx.from.toLowerCase() === walletAddress) {
                totalUsdtOut += amount
              }
            }
          })
          
          const netUsdtFlow = Math.abs(totalUsdtOut - totalUsdtIn)
          if (netUsdtFlow > 0) {
            console.log(`  📊 交易的USDT净流动: ${netUsdtFlow.toFixed(2)} USDT`)
          }

                     // 分析交易中的代币流向和价值
           let transactionUsdValue = 0 // 记录整笔交易的USD价值
           
           txGroup.forEach((tx: any) => {
             const originalSymbol = (tx.tokenSymbol || "").toUpperCase()
             // 先应用代币符号映射
             const symbol = TOKEN_SYMBOL_MAPPING[originalSymbol] || originalSymbol
             let decimals = Number.parseInt(tx.tokenDecimal || "18")
             
             // 验证decimals有效性
             if (isNaN(decimals) || decimals < 0 || decimals > 30) {
               console.log(`  ⚠️ 无效的decimals: ${decimals}, 使用默认值18`)
               decimals = 18
             }
             
             const value = Number.parseFloat(ethers.formatUnits(tx.value || "0", decimals))

             // 尝试获取BSCScan API提供的USD价值信息
             const usdValue = tx.tokenValue ? Number.parseFloat(tx.tokenValue) : 0

             // 简化输出：只记录重要的映射信息
             if (originalSymbol !== symbol) {
               console.log(`  映射: ${originalSymbol} -> ${symbol}`)
             }

             // 验证数值有效性
             if (isNaN(value) || value < 0) {
               console.log(`  ⚠️ 无效的交易数量: ${value}`)
               return
             }

             if (COMMON_TOKEN_SYMBOLS.includes(symbol)) {
               if (tx.from.toLowerCase() === walletAddress) {
                 // 钱包发出代币 - 只保留最大的发出数量（避免多次转账造成的重复）
                 if (value > fromAmount) {
                   fromToken = symbol
                   fromAmount = value
                   
                   // 如果是USDT，直接用数量作为USD价值
                   if (symbol === "USDT" && usdValue > 0) {
                     transactionUsdValue = Math.max(transactionUsdValue, usdValue)
                   } else if (symbol === "USDT") {
                     transactionUsdValue = Math.max(transactionUsdValue, value)
                   }
                 }
               } else if (tx.to.toLowerCase() === walletAddress) {
                 // 钱包接收代币 - 只保留最大的接收数量
                 if (value > toAmount) {
                   toToken = symbol
                   toAmount = value
                   
                   // 如果是USDT，直接用数量作为USD价值
                   if (symbol === "USDT" && usdValue > 0) {
                     transactionUsdValue = Math.max(transactionUsdValue, usdValue)
                   } else if (symbol === "USDT") {
                     transactionUsdValue = Math.max(transactionUsdValue, value)
                   }
                 }
               }
               
               // 对于非USDT代币，尝试使用BSCScan提供的USD价值
               if (symbol !== "USDT" && usdValue > 0) {
                 transactionUsdValue = Math.max(transactionUsdValue, usdValue)
               }
                            } else {
               // 忽略未知代币（避免日志冗余）
             }
           })

          console.log(`交易结果: ${fromToken}(${fromAmount}) -> ${toToken}(${toAmount})`)

          // 排除纯转账交易（只有发出或只有接收，没有兑换）
          const isPureTransfer = (fromToken && fromAmount > 0 && (!toToken || toAmount === 0)) || 
                                (!fromToken || fromAmount === 0 && toToken && toAmount > 0)
          
          if (isPureTransfer) {
            console.log(`  🚫 排除纯转账交易: ${fromToken}(${fromAmount}) -> ${toToken}(${toAmount})`)
            
            // 立即计算转账对磨损的影响
            if (fromToken === 'USDT' && fromAmount > 0) {
              // USDT转出：需要从交易前余额中减去（表示这部分资金不参与磨损计算）
              totalTransferAdjustment += fromAmount  // 正值表示需要减去
              console.log(`  📤 USDT转出: ${fromAmount.toFixed(2)} USDT，需要从交易前余额中减去`)
            } else if (toToken === 'USDT' && toAmount > 0) {
              // USDT转入：需要从交易前余额中加上（表示这部分资金要计入磨损计算）
              totalTransferAdjustment -= toAmount   // 负值表示需要加上
              console.log(`  📥 USDT转入: ${toAmount.toFixed(2)} USDT，需要从交易前余额中加上`)
            }
            
            return // 跳过纯转账交易，不加入交易列表
          }
          
          // 检查是否为有效交易对（用于识别交易）
          const isValidPair = ALL_TRADING_PAIRS.some((pair) => pair.from === fromToken && pair.to === toToken)
          
          // 检查是否计算交易量（根据用户规则）
          const shouldCountVolume = VOLUME_COUNTING_PAIRS.some((pair) => pair.from === fromToken && pair.to === toToken)
          
          // 验证交易数据的完整性
          const hasValidAmounts = fromAmount > 0 && toAmount > 0 && fromToken && toToken
          
          console.log(`  🔍 交易验证: isValidPair=${isValidPair}, hasValidAmounts=${hasValidAmounts}, isPureTransfer=${isPureTransfer}`)
          
          if (isValidPair && hasValidAmounts) {
            allValidTxHashes.add(hash)

            // 对于所有有效交易，都要计算USDT价值用于磨损计算
            let usdtValueForLoss = 0
            if (fromToken === "USDT") {
              // USDT买入其他代币：记录花费的USDT（负值表示支出）
              usdtValueForLoss = -fromAmount
            } else if (toToken === "USDT") {
              // 卖出代币换USDT：记录获得的USDT（正值表示收入）
              usdtValueForLoss = toAmount
            } else {
              // 其他代币之间的交易：磨损计算将在后续使用历史价格统一处理
              usdtValueForLoss = 0
            }

            // 记录交易时间和信息（用于后续排序）
            const firstTx = txGroup[0]
            const currentTransactionTime = Number.parseInt(firstTx.timeStamp)
            
            // 记录第一笔USDT买入其他代币的交易
            if (!hasFirstUsdtBuy && fromToken === "USDT") {
              firstUsdtBuyValue = fromAmount // 第一笔USDT买入的金额
              hasFirstUsdtBuy = true
              console.log(`📝 第一笔USDT买入交易: ${fromAmount.toFixed(2)} USDT → ${toToken}，时间: ${new Date(currentTransactionTime * 1000).toLocaleString()}，哈希: ${firstTx.hash}`)
            }
            
            console.log(`📝 当前交易: ${fromToken}→${toToken}，时间: ${new Date(currentTransactionTime * 1000).toLocaleString()}，哈希: ${firstTx.hash}`)

                                                   if (shouldCountVolume) {
                // 计算实际USDT价值 - 多种方法获取交易价值
                let actualVolume = 0 // 实际交易额（USDT价值）
                
                if (transactionUsdValue > 0) {
                  // 方法1：使用BSCScan API提供的USD价值
                  actualVolume = transactionUsdValue
                } else if (netUsdtFlow > 0) {
                  // 方法2：使用交易中的USDT净流动作为价值
                  actualVolume = netUsdtFlow
                } else if (fromToken === "USDT") {
                  // 方法3：USDT买入其他代币
                  actualVolume = fromAmount
                } else if (toToken === "USDT") {
                  // 方法4：卖出代币换USDT
                  actualVolume = toAmount
                } else {
                  // 方法5：使用交易链推算的价格计算交易价值
                  if (fromToken && fromAmount > 0) {
                    // 基于交易链推算价格（需要先构建价格映射）
                    // 这里先使用保守估算，稍后会重新计算
                    if (fromToken === "ZKJ") {
                      actualVolume = fromAmount * 2 // ZKJ临时估算价格$2
                    } else if (fromToken === "KOGE") {
                      actualVolume = fromAmount * 63 // KOGE临时估算价格$63
                    } else {
                      actualVolume = 0
                    }
                  } else {
                    actualVolume = 0
                  }
                }

                             // 只有当actualVolume > 0时才记录到交易列表和累计交易量
               if (actualVolume > 0) {
                 const transaction = {
                   hash: firstTx.hash,
                   from: firstTx.from,
                   to: firstTx.to,
                   value: fromAmount.toString(),
                   tokenSymbol: `${fromToken}→${toToken}`,
                   tokenName: `${fromToken} to ${toToken}`,
                   gasUsed: "0",
                   gasPrice: "0",
                   blockNumber: Number.parseInt(firstTx.blockNumber),
                   timestamp: Number.parseInt(firstTx.timeStamp),
                   usdValue: actualVolume, // 显示实际USDT价值
                   fromToken,
                   toToken,
                   fromAmount,
                   toAmount,
                 }
                 
                 allTransactions.push(transaction)
                 totalVolume += actualVolume // 累计实际USDT交易额
               }
            }
          }
        })

        // 重新计算交易价值（基于交易链推算的准确价格）
        if (allTransactions.length > 0) {
          console.log(`\n🔄 重新计算交易价值（基于交易链推算价格）...`)
          const priceMap = buildTokenPriceMap(allTransactions)
          
          // 重新计算总交易量
          totalVolume = 0
          
          allTransactions.forEach((tx, index) => {
            const fromToken = tx.fromToken
            const fromAmount = tx.fromAmount || 0
            
            if (fromToken && fromAmount > 0) {
              const tokenPrice = priceMap[fromToken] || 0
              if (tokenPrice > 0) {
                const newUsdValue = fromAmount * tokenPrice
                tx.usdValue = newUsdValue
                totalVolume += newUsdValue
                
                if (index < 3) { // 只显示前3个交易的详情
                  console.log(`  交易 ${index + 1}: ${fromAmount.toFixed(4)} ${fromToken} × $${tokenPrice.toFixed(4)} = $${newUsdValue.toFixed(2)}`)
                }
              }
            }
          })
          
          console.log(`  ✅ 重新计算完成，总交易量: $${totalVolume.toFixed(2)}`)
        }

        // 查询普通BNB交易（用于计算Gas费用）
        console.log(`\n=== 查询Gas费用 ===`)
        const txResponse = await fetch(
          `${baseUrl}?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&page=1&offset=1000&sort=asc&apikey=${bscscanApiKey}`,
        )
        
        const processedTxHashes = new Set<string>() // 避免重复计算同一交易的Gas费

        if (txResponse.ok) {
          const txData = await txResponse.json()
          if (txData.status === "1") {
            const bnbTransactions = txData.result || []
            console.log(`找到 ${bnbTransactions.length} 个BNB交易`)
            
            bnbTransactions.forEach((tx: any) => {
              // 只计算有效交易相关的Gas费，且避免重复计算
              if (allValidTxHashes.has(tx.hash) && tx.from.toLowerCase() === address.toLowerCase() && !processedTxHashes.has(tx.hash)) {
                const gasUsed = Number.parseInt(tx.gasUsed || "0")
                const gasPrice = Number.parseInt(tx.gasPrice || "0")
                const gasCost = (gasUsed * gasPrice) / 1e18
                totalGasUsed += gasCost
                processedTxHashes.add(tx.hash)
              }
            })
          } else {
            console.warn("获取BNB交易失败:", txData.message)
          }
        } else {
          console.error("BNB transactions API request failed:", txResponse.status)
        }
      } else {
        console.warn("获取代币交易失败:", tokenTxData.message)
      }

      // 计算交易磨损：对比第一笔和最后一笔有效交易时的账户余额
      
      if (allTransactions.length > 0) {
        // 按时间排序交易
        const sortedTransactions = allTransactions.sort((a, b) => a.timestamp - b.timestamp)
        const firstTransaction = sortedTransactions[0]
        const lastTransaction = sortedTransactions[sortedTransactions.length - 1]
        
        firstTransactionTime = firstTransaction.timestamp
        lastTransactionTime = lastTransaction.timestamp
        
        console.log(`📊 新式磨损计算:`)
        console.log(`  总交易数: ${allTransactions.length}`)
        console.log(`  第一笔交易时间: ${new Date(firstTransactionTime * 1000).toLocaleString()}`)
        console.log(`  最后一笔交易时间: ${new Date(lastTransactionTime * 1000).toLocaleString()}`)
        
        // 获取第一笔交易之前的余额（当天开始前的状态）
        console.log(`\n🔍 获取当天开始前的账户余额...`)
        firstTransactionBalances = await getHistoricalBalancesBeforeDate(address, selectedDate) // 当天开始前的余额
        
        // 获取当天截止时间的余额（如果当天未结束，使用当前时间）
        console.log(`\n🔍 获取当天截止时间的账户余额...`)
        const dayEndTimestamp = Math.floor(actualEndTime / 1000) // 使用当天的实际结束时间
        lastTransactionBalances = await getHistoricalBalances(address, dayEndTimestamp) // 当天截止时间的余额
        
        // 计算各代币余额变化并转换为USDT价值
        let totalUsdtChange = 0
        let totalBnbChange = 0
        
        console.log(`\n💰 余额变化分析:`)
        
        // 收集所有涉及的代币
        const allTokens = new Set([
          ...Object.keys(firstTransactionBalances),
          ...Object.keys(lastTransactionBalances)
        ])
        
        allTokens.forEach(symbol => {
          const beforeBalance = firstTransactionBalances[symbol] || 0
          const afterBalance = lastTransactionBalances[symbol] || 0
          const balanceChange = afterBalance - beforeBalance
          
          console.log(`  ${symbol}: ${beforeBalance.toFixed(4)} → ${afterBalance.toFixed(4)} (${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(4)})`)
          
          if (symbol === "BNB") {
            // BNB余额变化（主要是Gas费消耗）
            totalBnbChange = balanceChange
            console.log(`    🔥 BNB变化详情: ${totalBnbChange.toFixed(6)} BNB`)
            
            // 如果BNB余额数据不完整，尝试使用传统Gas费计算作为备用
            if (Math.abs(totalBnbChange) < 0.000001) { // 如果BNB变化几乎为0
              console.log(`    ⚠️ 检测到BNB变化几乎为0，可能是余额数据获取不完整`)
              console.log(`    🔄 尝试使用传统方法计算Gas费...`)
              
              // 这里可以回退到之前的Gas计算方法作为备用
              // 但先让我们看看是否是数据获取的问题
            }
          } else if (symbol === "USDT") {
            // USDT余额变化
            totalUsdtChange += balanceChange
          } else {
            // 其他代币余额变化将在后续使用历史价格统一计算
            console.log(`    → ${symbol}余额变化将在历史价格计算中处理`)
          }
        })
        
        // 检查BNB余额数据的完整性
        const hasBNBBefore = 'BNB' in firstTransactionBalances
        const hasBNBAfter = 'BNB' in lastTransactionBalances
        console.log(`\n🔍 BNB余额数据检查:`)
        console.log(`  交易前BNB数据: ${hasBNBBefore ? '✅' : '❌'} ${hasBNBBefore ? firstTransactionBalances['BNB'].toFixed(6) + ' BNB' : '缺失'}`)
        console.log(`  交易后BNB数据: ${hasBNBAfter ? '✅' : '❌'} ${hasBNBAfter ? lastTransactionBalances['BNB'].toFixed(6) + ' BNB' : '缺失'}`)
        
        if (!hasBNBBefore || !hasBNBAfter) {
          console.log(`  🚨 BNB余额数据不完整，尝试使用备用Gas计算方法`)
          
          // 备用方法：使用之前已经计算的totalGasUsed（来自传统方法）
          if (totalGasUsed > 0) {
            console.log(`  🔄 使用已计算的传统Gas费: ${totalGasUsed.toFixed(6)} BNB`)
            totalBnbChange = -totalGasUsed // 设置为负值表示BNB减少
          } else {
            console.log(`  ⚠️ 传统Gas费计算也为0，可能当天没有Gas消耗`)
            totalBnbChange = 0
          }
        }
        
        // 使用历史价格计算磨损
        let beforeTotalValue = 0
        let afterTotalValue = 0
        
        console.log(`\n💎 使用历史价格计算磨损...`)
        
        // 计算第一笔交易前的总价值
        for (const [symbol, balance] of Object.entries(firstTransactionBalances)) {
          if (balance > 0) {
            if (symbol === 'BNB') {
              // BNB价格需要查询当时的历史价格
              const historicalBnbPrice = await getHistoricalTokenPrice('BNB', firstTransactionTime, allTransactions)
              const value = balance * (historicalBnbPrice || bnbPrice) // 备用当前价格
              beforeTotalValue += value
            } else if (symbol === 'USDT' || symbol === 'USDC') {
              beforeTotalValue += balance
            } else {
              const historicalPrice = await getHistoricalTokenPrice(symbol, firstTransactionTime, allTransactions)
              const value = balance * historicalPrice
              beforeTotalValue += value
              
              // 添加异常检测
              if (historicalPrice > 1000) {
                console.warn(`⚠️ 警告: ${symbol} 价格异常高 ($${historicalPrice})，请检查CoinGecko ID是否正确`)
              }
              if (balance > 1000000) {
                console.warn(`⚠️ 警告: ${symbol} 余额异常高 (${balance.toFixed(4)})，请检查余额计算`)
              }
            }
          }
        }
        
        // 计算最后一笔交易后的总价值
        for (const [symbol, balance] of Object.entries(lastTransactionBalances)) {
          if (balance > 0) {
            if (symbol === 'BNB') {
              // BNB价格需要查询当时的历史价格
              const historicalBnbPrice = await getHistoricalTokenPrice('BNB', lastTransactionTime, allTransactions)
              const value = balance * (historicalBnbPrice || bnbPrice) // 备用当前价格
              afterTotalValue += value
            } else if (symbol === 'USDT' || symbol === 'USDC') {
              afterTotalValue += balance
            } else {
              const historicalPrice = await getHistoricalTokenPrice(symbol, lastTransactionTime, allTransactions)
              const value = balance * historicalPrice
              afterTotalValue += value
              
              // 添加异常检测
              if (historicalPrice > 1000) {
                console.warn(`⚠️ 警告: ${symbol} 价格异常高 ($${historicalPrice})，请检查CoinGecko ID是否正确`)
              }
              if (balance > 1000000) {
                console.warn(`⚠️ 警告: ${symbol} 余额异常高 (${balance.toFixed(4)})，请检查余额计算`)
              }
            }
          }
        }
        
        // 计算磨损 - 修正算法，排除正常的资金流动
        let tradingLoss = 0
        
        // 识别和排除大额资金流动（如提现转账）
        const usdtInflow = Math.max(0, totalUsdtChange) // USDT流入
        const usdtOutflow = Math.max(0, -totalUsdtChange) // USDT流出
        
        // 计算交易磨损：交易前非BNB代币价值 - 交易后非BNB代币价值 - 调整转入转出
        console.log(`  💡 使用价值比较法计算交易磨损...`)
        
        let beforeNonBnbValue = 0  // 交易前非BNB代币总价值
        let afterNonBnbValue = 0   // 交易后非BNB代币总价值
        
        console.log(`  📊 交易前非BNB代币价值:`)
        for (const [symbol, balance] of Object.entries(firstTransactionBalances)) {
          if (balance > 0 && symbol !== 'BNB') {
            let tokenPrice = 0
            if (symbol === 'USDT' || symbol === 'USDC') {
              tokenPrice = 1
            } else {
              tokenPrice = await getHistoricalTokenPrice(symbol, firstTransactionTime, allTransactions)
            }
            const value = balance * tokenPrice
            beforeNonBnbValue += value
            console.log(`    ${symbol}: ${balance.toFixed(4)} × $${tokenPrice.toFixed(4)} = $${value.toFixed(2)}`)
          }
        }
        
        console.log(`  📊 交易后非BNB代币价值:`)
        for (const [symbol, balance] of Object.entries(lastTransactionBalances)) {
          if (balance > 0 && symbol !== 'BNB') {
            let tokenPrice = 0
            if (symbol === 'USDT' || symbol === 'USDC') {
              tokenPrice = 1
            } else {
              tokenPrice = await getHistoricalTokenPrice(symbol, lastTransactionTime, allTransactions)
            }
            const value = balance * tokenPrice
            afterNonBnbValue += value
            console.log(`    ${symbol}: ${balance.toFixed(4)} × $${tokenPrice.toFixed(4)} = $${value.toFixed(2)}`)
          }
        }
        
                // 检测所有转账事件并调整交易前余额
        let adjustedBeforeValue = beforeNonBnbValue
        
        console.log(`  🔍 应用转账调整到磨损计算...`)
        console.log(`    总转账调整金额: ${totalTransferAdjustment > 0 ? '+' : ''}${totalTransferAdjustment.toFixed(2)} USDT`)
        
        // 应用转账调整
        adjustedBeforeValue = beforeNonBnbValue - totalTransferAdjustment
        
        console.log(`    转账检测完成，调整前: $${beforeNonBnbValue.toFixed(2)}, 调整后: $${adjustedBeforeValue.toFixed(2)}`)
        
        // 交易磨损 = 调整后的交易前价值 - 交易后价值
        tradingLoss = adjustedBeforeValue - afterNonBnbValue
        
        console.log(`  📊 价值比较法磨损计算:`)
        console.log(`    原始交易前非BNB代币总价值: $${beforeNonBnbValue.toFixed(2)}`)
        console.log(`    调整后交易前非BNB代币总价值: $${adjustedBeforeValue.toFixed(2)}`)
        console.log(`    交易后非BNB代币总价值: $${afterNonBnbValue.toFixed(2)}`)
        console.log(`    交易磨损: $${tradingLoss.toFixed(2)}`)
        
        gasLossUSDT = -totalBnbChange * bnbPrice // BNB损失转USDT（使用当前BNB价格估算Gas成本）
        usdtValueChange = tradingLoss
        
        console.log(`\n📊 基于历史价格的磨损计算:`)
        console.log(`  交易前总价值: $${beforeTotalValue.toFixed(2)}`)
        console.log(`  交易后总价值: $${afterTotalValue.toFixed(2)}`)
        console.log(`  交易磨损: $${tradingLoss.toFixed(2)}`)
        console.log(`  Gas磨损: $${gasLossUSDT.toFixed(2)}`)
        console.log(`  总磨损: $${(tradingLoss + gasLossUSDT).toFixed(2)}`)
        
        console.log(`\n🔍 磨损计算变量检查:`)
        console.log(`  totalUsdtChange: ${totalUsdtChange}`)
        console.log(`  totalBnbChange: ${totalBnbChange}`)
        console.log(`  bnbPrice: ${bnbPrice}`)
        console.log(`  tradingLoss: ${tradingLoss}`)
        console.log(`  gasLossUSDT: ${gasLossUSDT}`)
        
        console.log(`📈 磨损计算结果: 交易磨损 ${tradingLoss.toFixed(2)} USDT, Gas磨损 ${gasLossUSDT.toFixed(2)} USDT, 总磨损 ${(tradingLoss + gasLossUSDT).toFixed(2)} USDT`)
        
        // 更新totalGasUsed为实际的BNB消耗量
        totalGasUsed = Math.abs(totalBnbChange)
        
      } else {
        console.log(`⚠️ 当天没有有效交易，无法计算磨损`)
        usdtValueChange = 0
      }

      console.log(`\n=== 查询结果汇总 ===`)
      console.log(`有效交易数: ${allTransactions.length}`)
      console.log(`总交易量: $${totalVolume.toFixed(2)}`)
      console.log(`总Gas费: ${totalGasUsed.toFixed(6)} BNB`)
      console.log(`USDT价值变化: ${usdtValueChange > 0 ? '+' : ''}${usdtValueChange.toFixed(2)}`)

    } catch (error) {
      console.error("BSCScan API error:", error)
      // 保持已经计算的数据，只是记录错误
    }

          return {
        transactions: allTransactions,
        totalGasUsed, // BNB消耗量（绝对值）
        totalVolume,
        usdtValueChange, // 交易磨损（USDT价值）
        gasLossUSDT, // Gas磨损（USDT价值）
        lastTransactionTime: lastTransactionTime > 0 ? lastTransactionTime : undefined, // 最后一笔交易时间
        firstTransactionBalances, // 第一笔交易前的余额
        lastTransactionBalances,  // 最后一笔交易后的余额
        firstTransactionTime: firstTransactionTime > 0 ? firstTransactionTime : undefined, // 第一笔交易时间
      }
  }

  // 基于交易链的代币价格查询
  const getHistoricalTokenPrice = async (tokenSymbol: string, timestamp: number, transactions?: Transaction[]): Promise<number> => {
    try {
      // 对于稳定币，直接返回1
      if (tokenSymbol === 'USDT' || tokenSymbol === 'USDC' || tokenSymbol === 'BUSD') {
        return 1
      }

      console.log(`🔍 查询 ${tokenSymbol} 价格...`)

      // 如果有交易数据，基于交易链推算价格
      if (transactions && transactions.length > 0) {
        const priceMap = buildTokenPriceMap(transactions)
        const price = priceMap[tokenSymbol]
        if (price && price > 0) {
          console.log(`✅ 交易链推算价格: ${tokenSymbol} = $${price.toFixed(4)}`)
          return price
        }
      }

      // 备用价格（仅在无法推算时使用）
      const fallbackPrices: { [key: string]: number } = {
        'BNB': 600,    // BNB保守估算价格
      }

      const fallbackPrice = fallbackPrices[tokenSymbol] || 0
      if (fallbackPrice > 0) {
        console.log(`  ⚠️ 使用备用价格: ${tokenSymbol} = $${fallbackPrice}`)
        return fallbackPrice
      }

      console.warn(`⚠️ 无法获取 ${tokenSymbol} 的价格，返回0`)
      return 0

    } catch (error) {
      console.error(`获取 ${tokenSymbol} 价格失败:`, error)
      return 0
    }
  }

  // 计算指定日期开始前的余额（排除当天所有交易）
  const getHistoricalBalancesBeforeDate = async (
    address: string, 
    targetDate: string
  ): Promise<{ [symbol: string]: number }> => {
    try {
      // 将日期转换为UTC+8的8点开始时间戳
      const startDateTime = new Date(`${targetDate}T08:00:00+08:00`)
      const targetTimestamp = Math.floor(startDateTime.getTime() / 1000)
      
      console.log(`\n=== 计算 ${address} 在 ${targetDate} 开始前的余额 ===`)
      console.log(`目标时间: ${new Date(targetTimestamp * 1000).toLocaleString()} (UTC+8 早上8点前)`)
      
      const baseUrl = "https://api.bscscan.com/api"
      
      // 获取区块号的函数
      const getBlockByTimestamp = async (
        timestamp: number,
        closest: "before" | "after" = "before",
      ): Promise<number> => {
        const response = await fetch(
          `${baseUrl}?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=${closest}&apikey=${bscscanApiKey}`,
        )
        const data = await response.json()
        if (data.status === "1") {
          return Number.parseInt(data.result)
        }
        throw new Error(`Failed to get block number for timestamp ${timestamp}`)
      }
      
      const targetBlock = await getBlockByTimestamp(targetTimestamp, "before")
      
      console.log(`查询到区块 ${targetBlock} (${targetDate} 早上8点前的最后一个区块)`)
      
      // 获取从创世区块到目标时间点的所有代币交易
      const tokenTxResponse = await fetch(
        `${baseUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=${targetBlock}&page=1&offset=10000&sort=asc&apikey=${bscscanApiKey}`,
      )
      
      if (!tokenTxResponse.ok) {
        console.error("Historical token transactions API request failed:", tokenTxResponse.status)
        return {}
      }

      const tokenTxData = await tokenTxResponse.json()
      if (tokenTxData.status !== "1") {
        console.warn("无法获取历史交易数据:", tokenTxData.message)
        return {}
      }

      const tokenTransactions = tokenTxData.result || []
      console.log(`分析 ${tokenTransactions.length} 个历史代币交易 (${targetDate} 之前)`)

      // 按代币分类统计余额变化
      const balanceChanges: { [symbol: string]: number } = {}
      
      tokenTransactions.forEach((tx: any) => {
        const originalSymbol = (tx.tokenSymbol || "").toUpperCase()
        const symbol = TOKEN_SYMBOL_MAPPING[originalSymbol] || originalSymbol
        
        // 只处理我们关心的代币
        if (!COMMON_TOKEN_SYMBOLS.includes(symbol)) return
        
        const decimals = Number.parseInt(tx.tokenDecimal || "18")
        const amount = Number.parseFloat(ethers.formatUnits(tx.value || "0", decimals))
        
        if (!balanceChanges[symbol]) {
          balanceChanges[symbol] = 0
        }
        
        // 如果是转入钱包，余额增加；如果是转出钱包，余额减少
        if (tx.to.toLowerCase() === address.toLowerCase()) {
          balanceChanges[symbol] += amount
        } else if (tx.from.toLowerCase() === address.toLowerCase()) {
          balanceChanges[symbol] -= amount
        }
      })

      // 获取目标时间点的BNB余额
      try {
        console.log(`  🔍 查询区块 ${targetBlock} 的BNB余额...`)
        const bnbResponse = await fetch(
          `${baseUrl}?module=account&action=balance&address=${address}&tag=${targetBlock}&apikey=${bscscanApiKey}`,
        )
        const bnbData = await bnbResponse.json()
        
        if (bnbData.status === "1") {
          const bnbBalance = Number.parseFloat(ethers.formatEther(bnbData.result))
          balanceChanges["BNB"] = bnbBalance
          console.log(`  ✅ [BNB] ${bnbBalance.toFixed(6)}`)
        } else {
          console.error(`  ❌ BNB余额查询失败: ${bnbData.message}`)
        }
      } catch (error) {
        console.error("  💥 BNB余额查询网络错误:", error)
      }

      console.log(`💰 ${targetDate} 开始前余额统计: ${Object.keys(balanceChanges).length} 种代币`)
      Object.entries(balanceChanges).forEach(([symbol, balance]) => {
        console.log(`  ${symbol}: ${balance.toFixed(4)}`)
      })

      return balanceChanges
    } catch (error) {
      console.error("计算日期开始前余额失败:", error)
      return {}
    }
  }

  // 基于交易链推算代币价格
  const buildTokenPriceMap = (transactions: Transaction[]): { [symbol: string]: number } => {
    const priceMap: { [symbol: string]: number } = {
      'USDT': 1,
      'USDC': 1,
      'BUSD': 1
    }
    
    console.log(`  🔗 基于交易链推算代币价格...`)
    
    // 按时间戳排序交易，确保按顺序推算价格
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp)
    
    for (const tx of sortedTxs) {
      const fromToken = tx.fromToken
      const toToken = tx.toToken
      const fromAmount = tx.fromAmount || 0
      const toAmount = tx.toAmount || 0
      
      if (fromAmount > 0 && toAmount > 0 && fromToken && toToken) {
        // 如果from代币价格已知，to代币价格未知，则推算to代币价格
        if (priceMap[fromToken] && !priceMap[toToken]) {
          const toTokenPrice = (fromAmount * priceMap[fromToken]) / toAmount
          priceMap[toToken] = toTokenPrice
          console.log(`    ✅ 推算出 ${toToken} 价格: $${toTokenPrice.toFixed(4)} (基于 ${fromToken}→${toToken})`)
        }
        // 如果to代币价格已知，from代币价格未知，则推算from代币价格
        else if (priceMap[toToken] && !priceMap[fromToken]) {
          const fromTokenPrice = (toAmount * priceMap[toToken]) / fromAmount
          priceMap[fromToken] = fromTokenPrice
          console.log(`    ✅ 推算出 ${fromToken} 价格: $${fromTokenPrice.toFixed(4)} (基于 ${fromToken}→${toToken})`)
        }
      }
    }
    
    // 为BNB设置合理的备用价格
    if (!priceMap['BNB']) {
      priceMap['BNB'] = 600 // BNB保守估算价格
      console.log(`    ⚠️ BNB使用备用价格: $600`)
    }
    
    console.log(`  📊 最终价格映射:`, priceMap)
    return priceMap
  }



  // 计算历史余额：通过交易历史反推特定时间点的余额
  const getHistoricalBalances = async (
    address: string, 
    targetTimestamp: number
  ): Promise<{ [symbol: string]: number }> => {
    try {
      const baseUrl = "https://api.bscscan.com/api"
      
      // 获取区块号的函数
      const getBlockByTimestamp = async (
        timestamp: number,
        closest: "before" | "after" = "before",
      ): Promise<number> => {
        const response = await fetch(
          `${baseUrl}?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=${closest}&apikey=${bscscanApiKey}`,
        )
        const data = await response.json()
        if (data.status === "1") {
          return Number.parseInt(data.result)
        }
        throw new Error(`Failed to get block number for timestamp ${timestamp}`)
      }
      
      const targetBlock = await getBlockByTimestamp(targetTimestamp, "after")
      
      console.log(`\n=== 计算 ${address} 在区块 ${targetBlock} 时的历史余额 ===`)
      
      // 获取从创世区块到目标时间点的所有代币交易
      const tokenTxResponse = await fetch(
        `${baseUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=${targetBlock}&page=1&offset=10000&sort=asc&apikey=${bscscanApiKey}`,
      )
      
      if (!tokenTxResponse.ok) {
        console.error("Historical token transactions API request failed:", tokenTxResponse.status)
        return {}
      }

      const tokenTxData = await tokenTxResponse.json()
      if (tokenTxData.status !== "1") {
        console.warn("无法获取历史交易数据:", tokenTxData.message)
        return {}
      }

      const tokenTransactions = tokenTxData.result || []
      console.log(`分析 ${tokenTransactions.length} 个历史代币交易`)

      // 按代币分类统计余额变化
      const balanceChanges: { [symbol: string]: number } = {}
      
      tokenTransactions.forEach((tx: any) => {
        const originalSymbol = (tx.tokenSymbol || "").toUpperCase()
        const symbol = TOKEN_SYMBOL_MAPPING[originalSymbol] || originalSymbol
        
        // 只处理我们关心的代币
        if (!COMMON_TOKEN_SYMBOLS.includes(symbol)) return
        
        const decimals = Number.parseInt(tx.tokenDecimal || "18")
        const amount = Number.parseFloat(ethers.formatUnits(tx.value || "0", decimals))
        
        if (!balanceChanges[symbol]) {
          balanceChanges[symbol] = 0
        }
        
        // 如果是转入钱包，余额增加；如果是转出钱包，余额减少
        if (tx.to.toLowerCase() === address.toLowerCase()) {
          balanceChanges[symbol] += amount
        } else if (tx.from.toLowerCase() === address.toLowerCase()) {
          balanceChanges[symbol] -= amount
        }
      })

      // 获取BNB余额（多种方法尝试）
      let bnbBalance = 0
      let bnbQuerySuccess = false
      
      // 方法1：查询特定区块的BNB余额
      try {
        console.log(`  🔍 方法1：查询区块 ${targetBlock} 的BNB余额...`)
        const bnbResponse = await fetch(
          `${baseUrl}?module=account&action=balance&address=${address}&tag=${targetBlock}&apikey=${bscscanApiKey}`,
        )
        const bnbData = await bnbResponse.json()
        console.log(`  📊 BNB余额API响应:`, bnbData)
        
        if (bnbData.status === "1") {
          bnbBalance = Number.parseFloat(ethers.formatEther(bnbData.result))
          balanceChanges["BNB"] = bnbBalance
          bnbQuerySuccess = true
          console.log(`  ✅ [BNB] ${bnbBalance.toFixed(6)} (区块 ${targetBlock} 查询成功)`)
        } else {
          console.error(`  ❌ 方法1失败: ${bnbData.message}`)
        }
      } catch (error) {
        console.error("  💥 方法1网络错误:", error)
      }
      
      // 方法2：如果方法1失败，查询latest余额然后通过交易记录反推
      if (!bnbQuerySuccess) {
        try {
          console.log(`  🔄 方法2：查询交易结束后余额并通过交易记录反推...`)
          
          // 获取当前BNB余额
          const currentBnbResponse = await fetch(
            `${baseUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${bscscanApiKey}`,
          )
          const currentBnbData = await currentBnbResponse.json()
          
          if (currentBnbData.status === "1") {
            const currentBnbBalance = Number.parseFloat(ethers.formatEther(currentBnbData.result))
            console.log(`  📈 当前BNB余额: ${currentBnbBalance.toFixed(6)}`)
            
            // 获取从目标时间点到现在的所有BNB交易
            const bnbTxResponse = await fetch(
              `${baseUrl}?module=account&action=txlist&address=${address}&startblock=${targetBlock}&endblock=latest&page=1&offset=1000&sort=asc&apikey=${bscscanApiKey}`,
            )
            const bnbTxData = await bnbTxResponse.json()
            
            if (bnbTxData.status === "1") {
              const bnbTransactions = bnbTxData.result || []
              console.log(`  📊 找到 ${bnbTransactions.length} 个BNB交易`)
              
              // 反推目标时间点的BNB余额
              let targetTimeBnbBalance = currentBnbBalance
              
              bnbTransactions.forEach((tx: any) => {
                if (Number.parseInt(tx.timeStamp) > targetTimestamp) {
                  const value = Number.parseFloat(ethers.formatEther(tx.value || "0"))
                  const gasUsed = Number.parseInt(tx.gasUsed || "0")
                  const gasPrice = Number.parseInt(tx.gasPrice || "0")
                  const gasCost = (gasUsed * gasPrice) / 1e18
                  
                  if (tx.from.toLowerCase() === address.toLowerCase()) {
                    // 发出的交易：加回转出的金额和Gas费
                    targetTimeBnbBalance += value + gasCost
                  } else if (tx.to.toLowerCase() === address.toLowerCase()) {
                    // 接收的交易：减去收到的金额
                    targetTimeBnbBalance -= value
                  }
                }
              })
              
              balanceChanges["BNB"] = targetTimeBnbBalance
              bnbQuerySuccess = true
              console.log(`  ✅ [BNB] ${targetTimeBnbBalance.toFixed(6)} (通过反推计算)`)
            }
          }
        } catch (error) {
          console.error("  💥 方法2失败:", error)
        }
      }
      
      // 如果两种方法都失败，记录警告
      if (!bnbQuerySuccess) {
        console.warn(`  ⚠️ 无法获取区块 ${targetBlock} 的BNB余额，Gas磨损计算将不准确`)
      }

      console.log(`💰 历史余额统计: ${Object.keys(balanceChanges).length} 种代币余额`)

      return balanceChanges
    } catch (error) {
      console.error("计算历史余额失败:", error)
      return {}
    }
  }



  // 查询单个钱包数据
  const queryWalletData = async (wallet: Wallet): Promise<WalletData> => {
    try {
      // 获取代币余额
      const tokenBalances = await getTokenBalances(wallet.address)
      const totalBalance = tokenBalances.reduce((sum, token) => sum + token.usdValue, 0)

      // 获取交易数据
      const { 
        transactions, 
        totalGasUsed, 
        totalVolume, 
        usdtValueChange, 
        gasLossUSDT,
        lastTransactionTime,
        firstTransactionBalances,
        lastTransactionBalances,
        firstTransactionTime
      } = await getTransactionsFromBSCScan(wallet.address, selectedDate)

      // 缓存交易数据
      setWalletTransactionsCache(prev => ({
        ...prev,
        [wallet.address]: transactions
      }))

      // 如果有交易，获取最后一笔交易时的历史余额
      let historicalBalances: { [symbol: string]: number } | undefined
      if (lastTransactionTime && transactions.length > 0) {
        console.log(`\n🕒 获取钱包 ${wallet.address} 在最后一笔交易完成时的历史余额...`)
        historicalBalances = await getHistoricalBalances(wallet.address, lastTransactionTime)
        
        console.log(`📊 最后一笔交易时的余额统计:`)
        if (historicalBalances && Object.keys(historicalBalances).length > 0) {
          Object.entries(historicalBalances).forEach(([symbol, balance]) => {
            console.log(`  ${symbol}: ${balance.toFixed(4)}`)
          })
        } else {
          console.log(`  ⚠️ 未能获取历史余额数据`)
        }
      }

      // 计算预估积分
      // 1. 余额积分：基于钱包USDT和BNB余额
      const usdtBnbBalance = tokenBalances
        .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
        .reduce((total, token) => total + token.usdValue, 0)
      const balancePoints = PointsUtils.balance(usdtBnbBalance)
      
      // 2. 交易量积分：BSC链实际交易额乘以2后计算积分
      const tradingVolumePoints = PointsUtils.bscTradingVolume(totalVolume) // 内部会将totalVolume*2然后计算积分
      
      const estimatedPoints = balancePoints + tradingVolumePoints

      console.log(`\n🧮 钱包 ${wallet.address} 积分计算明细:`)
      console.log(`  📊 余额积分: $${usdtBnbBalance.toFixed(2)} (仅USDT+BNB) → ${balancePoints}分`)
      console.log(`  📈 交易量积分:`)
      console.log(`    - 实际交易额: $${totalVolume.toFixed(2)}`)
      console.log(`    - BSC翻倍后: $${(totalVolume * 2).toFixed(2)}`)
      console.log(`    - 对应积分: ${tradingVolumePoints}分`) 
      console.log(`  🏆 总积分: ${balancePoints} + ${tradingVolumePoints} = ${estimatedPoints}分`)

      // 磨损明细（已在getTransactionsFromBSCScan中计算完成）
      const tradingLoss = usdtValueChange  // 交易磨损（USDT价值变化）
      const gasLoss = gasLossUSDT         // Gas磨损（BNB消耗转USDT）
      const totalLoss = tradingLoss + gasLoss  // 总磨损

      console.log(`💰 磨损明细计算:`)
      console.log(`  交易磨损: ${tradingLoss.toFixed(2)} USDT`)
      console.log(`  Gas磨损: ${gasLoss.toFixed(2)} USDT (${totalGasUsed.toFixed(6)} BNB × $${bnbPrice.toFixed(2)})`)
      console.log(`  总磨损: ${totalLoss.toFixed(2)} USDT`)

              return {
          address: wallet.address,
          note: wallet.note,
          totalBalance,
          tokenBalances,
          tradingVolume: totalVolume, // 显示实际交易额
          transactionCount: transactions.length,
          estimatedPoints,
          revenue: tradingLoss, // 交易磨损
          gasUsed: gasLoss, // Gas磨损（USDT价值）
          usdtValueChange, // USDT价值变化
          historicalBalances, // 最后一笔交易时的历史余额
          lastTransactionTime, // 最后一笔交易时间
          firstTransactionBalances, // 第一笔交易前的余额
          lastTransactionBalances, // 最后一笔交易后的余额
          firstTransactionTime, // 第一笔交易时间
        }
    } catch (error) {
      console.error(`Error querying wallet ${wallet.address}:`, error)
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
        usdtValueChange: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // 批量查询钱包数据
  const handleBatchQuery = async () => {
    if (wallets.length === 0 || !provider) return

    setIsQuerying(true)
    setHasQueried(true)

    // 清除之前的交易缓存，确保数据一致性
    setWalletTransactionsCache({})
    console.log(`🗑️ 清除交易缓存，重新查询所有钱包数据`)

    // 初始化加载状态
    const loadingData = wallets.map((wallet) => ({
      address: wallet.address,
      note: wallet.note,
      totalBalance: 0,
      tokenBalances: [],
      tradingVolume: 0,
      transactionCount: 0,
      estimatedPoints: 0,
      revenue: 0,
      gasUsed: 0,
      usdtValueChange: 0,
      isLoading: true,
    }))

    setWalletData(loadingData)

    console.log(`\n🚀 开始批量查询 ${wallets.length} 个钱包的 ${selectedDate} 数据`)

    try {
      // 决定使用串行还是并行查询
      const useParallel = wallets.length <= 3 // 3个以下使用并行，以上使用串行避免API限制
      let results: WalletData[] = []
      
      if (useParallel) {
        console.log(`\n🚀 并行查询 ${wallets.length} 个钱包...`)
        // 并行查询所有钱包
        const promises = wallets.map(async (wallet, index) => {
          try {
            console.log(`📊 开始查询钱包 ${index + 1}: ${wallet.address}`)
            const result = await queryWalletData(wallet)
            console.log(`✅ 钱包 ${index + 1} 查询完成`)
            return result
          } catch (error) {
            console.error(`❌ 钱包 ${index + 1} 查询失败:`, error)
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
              usdtValueChange: 0,
              error: error instanceof Error ? error.message : "查询失败",
            }
          }
        })
        
        results = await Promise.all(promises)
        
        // 一次性更新所有结果
        setWalletData(results.map(result => ({ ...result, isLoading: false })))
        
      } else {
        console.log(`\n🚀 串行查询 ${wallets.length} 个钱包（避免API限制）...`)
        // 串行查询避免API限制
        results = []

        for (let i = 0; i < wallets.length; i++) {
          const wallet = wallets[i]
          console.log(`\n📊 查询进度: ${i + 1}/${wallets.length} - ${wallet.address}`)
          
          try {
            const result = await queryWalletData(wallet)
            results[i] = result
            
            console.log(`✅ 钱包 ${i + 1} 查询完成:`)
            console.log(`   - 余额: $${result.totalBalance.toFixed(2)}`)
            console.log(`   - 交易量: $${result.tradingVolume.toFixed(2)}`)
            console.log(`   - 交易次数: ${result.transactionCount}`)
            console.log(`   - Gas费: $${result.gasUsed.toFixed(2)}`)
            console.log(`   - 预估积分: ${result.estimatedPoints}`)
            
          } catch (error) {
            console.error(`❌ 钱包 ${i + 1} 查询失败:`, error)
            results[i] = {
              address: wallet.address,
              note: wallet.note,
              totalBalance: 0,
              tokenBalances: [],
              tradingVolume: 0,
              transactionCount: 0,
              estimatedPoints: 0,
              revenue: 0,
              gasUsed: 0,
              usdtValueChange: 0,
              error: error instanceof Error ? error.message : "查询失败",
            }
          }

          // 实时更新结果
          setWalletData((prev) => {
            const newData = [...prev]
            newData[i] = { ...results[i], isLoading: false }
            return newData
          })

          // 添加延迟避免API限制（除了最后一个）
          if (i < wallets.length - 1) {
            console.log(`⏳ 等待 2 秒避免API限制...`)
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }
      }

      // 计算总计数据
      const successfulQueries = results.filter((r: WalletData) => !r.error).length
      const failedQueries = results.filter((r: WalletData) => r.error).length
      const totalVolume = results.reduce((sum: number, r: WalletData) => sum + r.tradingVolume, 0)
      const totalRevenue = results.reduce((sum: number, r: WalletData) => sum + r.revenue, 0)
      const totalTransactions = results.reduce((sum: number, r: WalletData) => sum + r.transactionCount, 0)
      const totalPoints = results.reduce((sum: number, r: WalletData) => sum + r.estimatedPoints, 0)

      console.log(`\n📈 批量查询完成统计:`)
      console.log(`   - 总钱包数: ${wallets.length}`)
      console.log(`   - 成功查询: ${successfulQueries}`)
      console.log(`   - 失败查询: ${failedQueries}`)
      console.log(`   - 总交易量: $${totalVolume.toFixed(2)}`)
      console.log(`   - 总收益: $${totalRevenue.toFixed(2)}`)
      console.log(`   - 总交易次数: ${totalTransactions}`)
      console.log(`   - 总预估积分: ${totalPoints}`)

    } catch (error) {
      console.error("批量查询发生严重错误:", error)
    } finally {
      setIsQuerying(false)
    }
  }

  // 查询交易详情
  const handleViewTransactionDetails = async (address: string) => {
    setSelectedWalletAddress(address)
    setTransactionModalOpen(true)
    setIsLoadingTransactions(true)

    try {
      // 首先检查缓存
      const cachedTransactions = walletTransactionsCache[address]
      if (cachedTransactions) {
        console.log(`📋 使用缓存的交易数据，共 ${cachedTransactions.length} 笔交易`)
        setSelectedWalletTransactions(cachedTransactions)
        setIsLoadingTransactions(false)
        return
      }

      // 如果缓存中没有，再查询API
      console.log(`🔍 缓存中没有数据，重新查询钱包 ${address} 的交易...`)
      const { transactions } = await getTransactionsFromBSCScan(address, selectedDate)
      setSelectedWalletTransactions(transactions)
      
      // 同时更新缓存
      setWalletTransactionsCache(prev => ({
        ...prev,
        [address]: transactions
      }))
    } catch (error) {
      console.error("Error loading transactions:", error)
      setSelectedWalletTransactions([])
    } finally {
      setIsLoadingTransactions(false)
    }
  }

  // 计算总计数据
  const totalStats = {
    totalTransactions: walletData.reduce((sum, wallet) => sum + wallet.transactionCount, 0),
    totalVolume: walletData.reduce((sum, wallet) => sum + wallet.tradingVolume, 0),
    totalRevenue: walletData.reduce((sum, wallet) => sum + wallet.revenue, 0),
    totalPoints: walletData.reduce((sum, wallet) => sum + wallet.estimatedPoints, 0),
    totalBalance: walletData.reduce((sum, wallet) => {
      // 只统计USDT和BNB余额
      if (wallet.lastTransactionBalances && Object.keys(wallet.lastTransactionBalances).length > 0) {
        return sum + Object.entries(wallet.lastTransactionBalances).reduce((total, [symbol, balance]) => {
          if (symbol === "USDT") return total + balance;
          if (symbol === "BNB") return total + balance * bnbPrice;
          return total;
        }, 0);
      } else {
        return sum + wallet.tokenBalances
          .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
          .reduce((total, token) => total + token.usdValue, 0);
      }
    }, 0),
    totalGasUsed: walletData.reduce((sum, wallet) => sum + wallet.gasUsed, 0),
    totalUsdtValueChange: walletData.reduce((sum, wallet) => sum + (wallet.usdtValueChange || 0), 0),
  }

  // 截断钱包地址
  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  const copyToClipboard = async (text: string) => {
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
      console.log("地址已复制到剪贴板:", text)
    } catch (err) {
      console.error("复制失败:", err)
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
        console.log("使用降级方案复制成功")
      } catch (fallbackErr) {
        console.error("降级方案也失败了:", fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
  }

  const handleImportWallets = () => {
    const lines = walletInput.trim().split("\n")
    const newWallets = lines
      .map((line) => {
        const parts = line.split(",")
        const address = parts[0].trim()
        const note = parts.length > 1 ? parts[1].trim() : "-"

        if (!ethers.isAddress(address)) {
          console.warn(`Invalid address: ${address}`)
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
  }

  const handleRemoveWallet = (addressToRemove: string) => {
    setWallets((prev) => prev.filter((wallet) => wallet.address !== addressToRemove))
    setWalletData((prev) => prev.filter((data) => data.address !== addressToRemove))

    if (wallets.length <= 1) {
      setHasQueried(false)
      setWalletData([])
    }
  }

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

  const sortedWallets = [...filteredWallets].sort((a, b) => {
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

  const handleSelectWallet = (address: string, checked: boolean) => {
    if (checked) {
      setSelectedWallets((prev) => [...prev, address])
    } else {
      setSelectedWallets((prev) => prev.filter((addr) => addr !== address))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWallets(wallets.map((wallet) => wallet.address))
    } else {
      setSelectedWallets([])
    }
  }

  const handleBatchDelete = () => {
    const remainingWallets = wallets.filter((wallet) => !selectedWallets.includes(wallet.address))
    const remainingData = walletData.filter((data) => !selectedWallets.includes(data.address))

    setWallets(remainingWallets)
    setWalletData(remainingData)
    setSelectedWallets([])

    if (remainingWallets.length === 0) {
      setHasQueried(false)
    }
  }

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

        {/* 网络配置信息卡片 - 四个项目在一行 */}
        <Card className="mb-8 shadow-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg py-2">
            <CardTitle className="text-base font-normal flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setConfigModalOpen(true)}
                  className="flex items-center gap-2 hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-white font-medium">网络配置</span>
                </button>
                {getNetworkStatusBadge()}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshNetwork}
                  disabled={networkStatus === "connecting"}
                  className="p-1 h-6 w-6 hover:bg-white/20 text-white"
                  title="刷新连接"
                >
                  {networkStatus === "connecting" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
              </div>
              <div></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-4 gap-6 text-sm">
              <div>
                <Label className="text-gray-600">网络</Label>
                <div className="font-medium">{BSC_CONFIG.name}</div>
              </div>
              <div>
                <Label className="text-gray-600">RPC节点</Label>
                <div
                  className="font-medium text-xs truncate max-w-[200px]"
                  title={
                    selectedRpcIndex === BSC_CONFIG.rpcUrls.length
                      ? customRpcUrl || "自定义节点"
                      : BSC_CONFIG.rpcUrls[selectedRpcIndex]
                  }
                >
                  {selectedRpcIndex === BSC_CONFIG.rpcUrls.length
                    ? customRpcUrl || "自定义节点"
                    : BSC_CONFIG.rpcUrls[selectedRpcIndex]}
                </div>
              </div>
              <div>
                <Label className="text-gray-600">BSCScan API</Label>
                <div className="font-medium font-mono text-xs">
                  {bscscanApiKey ? `${bscscanApiKey.substring(0, 8)}...` : "未配置"}
                </div>
              </div>
              <div>
                <Label className="text-gray-600">BNB价格</Label>
                <div className="font-medium flex items-center gap-2">
                  ${bnbPrice.toFixed(2)} USDT
                  {isLoadingPrice && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
              </div>
            </div>

            {/* 网络错误信息在配置卡片内显示 */}
            {networkStatus === "error" && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <div className="font-medium text-red-800">网络连接失败</div>
                </div>
                <div className="text-sm text-red-700 mb-3">
                  可能原因：RPC节点超时、网络限制或节点维护。系统已自动尝试下一个节点。
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefreshNetwork}
                    className="bg-white hover:bg-gray-50 text-red-600 border-red-300"
                  >
                    重试连接
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setConfigModalOpen(true)}
                    className="bg-white hover:bg-gray-50 text-red-600 border-red-300"
                  >
                    切换节点
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 操作按钮区域 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white py-3 text-base font-normal"
            onClick={() => setWalletModalOpen(true)}
          >
            管理钱包 ({wallets.length})
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white py-3 text-base font-normal flex items-center justify-center gap-2"
            onClick={handleBatchQuery}
            disabled={wallets.length === 0 || isQuerying || networkStatus !== "connected"}
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
            className="bg-green-500 hover:bg-green-600 text-white py-3 text-base font-normal"
            disabled={walletData.length === 0}
          >
            导出数据
          </Button>
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

        {/* 数据展示区域 */}
        {walletData.length > 0 ? (
          <>
            {/* 视图控制 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-light">日期</span>
                  <Input type="date" value={selectedDate} onChange={handleDateChange} className="w-40 font-light" />
                </div>
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
                                {wallet.lastTransactionBalances && Object.keys(wallet.lastTransactionBalances).length > 0 ? (
                                  <>
                                    <span className="text-green-600 font-normal">
                                      $
                                      {Object.entries(wallet.lastTransactionBalances).reduce((total, [symbol, balance]) => {
                                        if (symbol === "USDT") return total + balance;
                                        if (symbol === "BNB") return total + balance * bnbPrice;
                                        return total;
                                      }, 0).toFixed(2)}
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {Object.entries(wallet.lastTransactionBalances)
                                        .filter(([symbol]) => symbol === "USDT" || symbol === "BNB")
                                        .map(([symbol, balance]) => (
                                        <div key={symbol}>
                                          {balance.toFixed(4)} {symbol}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-green-600 font-normal">
                                      $
                                      {wallet.tokenBalances
                                        .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
                                        .reduce((total, token) => total + token.usdValue, 0)
                                        .toFixed(2)}
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {wallet.tokenBalances
                                        .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
                                        .map((token, index) => (
                                        <div key={index}>
                                          {token.balance.toFixed(4)} {token.symbol.replace(" (BSC)", "")}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
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
                                    wallet.lastTransactionBalances && Object.keys(wallet.lastTransactionBalances).length > 0
                                      ? Object.entries(wallet.lastTransactionBalances).reduce((total, [symbol, balance]) => {
                                          if (symbol === "USDT") return total + balance;
                                          if (symbol === "BNB") return total + balance * bnbPrice;
                                          return total;
                                        }, 0)
                                      : wallet.tokenBalances
                                          .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
                                          .reduce((total, token) => total + token.usdValue, 0)
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
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-sm text-gray-500">查询中</span>
                                </div>
                              ) : wallet.error ? (
                                <span className="text-red-500 text-sm">查询失败</span>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-blue-500 hover:bg-blue-600 text-white font-light"
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
                            {wallet.lastTransactionBalances && Object.keys(wallet.lastTransactionBalances).length > 0 ? (
                              <>
                                <div className="text-green-600 font-normal">
                                  $
                                  {Object.entries(wallet.lastTransactionBalances).reduce((total, [symbol, balance]) => {
                                    if (symbol === "USDT") return total + balance;
                                    if (symbol === "BNB") return total + balance * bnbPrice;
                                    return total;
                                  }, 0).toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {Object.entries(wallet.lastTransactionBalances)
                                    .filter(([symbol]) => symbol === "USDT" || symbol === "BNB")
                                    .map(([symbol, balance]) => (
                                    <div key={symbol}>
                                      {balance.toFixed(4)} {symbol}
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-green-600 font-normal">
                                  $
                                  {wallet.tokenBalances
                                    .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
                                    .reduce((total, token) => total + token.usdValue, 0)
                                    .toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {wallet.tokenBalances
                                    .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
                                    .map((token, index) => (
                                    <div key={index}>
                                      {token.balance.toFixed(4)} {token.symbol.replace(" (BSC)", "")}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
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
                                wallet.lastTransactionBalances && Object.keys(wallet.lastTransactionBalances).length > 0
                                  ? Object.entries(wallet.lastTransactionBalances).reduce((total, [symbol, balance]) => {
                                      if (symbol === "USDT") return total + balance;
                                      if (symbol === "BNB") return total + balance * bnbPrice;
                                      return total;
                                    }, 0)
                                  : wallet.tokenBalances
                                      .filter(token => token.symbol === "BNB" || token.symbol.includes("USDT"))
                                      .reduce((total, token) => total + token.usdValue, 0)
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
                          <div className="flex items-center justify-center gap-2 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm text-gray-500">查询中...</span>
                          </div>
                        ) : wallet.error ? (
                          <div className="text-red-500 text-sm text-center py-2">查询失败: {wallet.error}</div>
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
        ) : wallets.length > 0 && !hasQueried ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4 font-light">
              已添加 {wallets.length} 个钱包地址，点击"批量查询数据"开始查询
            </p>
            <Button
              onClick={handleBatchQuery}
              className="bg-orange-500 hover:bg-orange-600 text-white font-light"
              disabled={networkStatus !== "connected"}
            >
              {networkStatus === "connected" ? "批量查询数据" : "等待网络连接..."}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4 font-light">请先添加钱包地址以查看链上交易数据</p>
            <Button
              onClick={() => setWalletModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-light"
            >
              添加钱包
            </Button>
          </div>
        )}
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
                    <div>📍 获取当天开始前非BNB代币余额</div>
                    <div>📍 获取当天结束时非BNB代币余额</div>
                    <div>📍 排除纯转账影响（转入转出调整）</div>
                    <div className="font-semibold text-red-600">💰 磨损 = 开始余额 - 结束余额</div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                  <h4 className="font-semibold text-orange-700 mb-3">⛽ Gas磨损</h4>
                  <div className="space-y-2 text-sm">
                    <div>📍 获取当天开始前BNB余额</div>
                    <div>📍 获取当天结束时BNB余额</div>
                    <div>📍 按当前BNB价格转换为USDT</div>
                    <div className="font-semibold text-orange-600">⛽ Gas费 = BNB减少量 × BNB价格</div>
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
                    <strong className="text-red-700">交易磨损示例：</strong><br/>
                    开始时：1200 USDT等值<br/>
                    结束时：1195.2 USDT等值<br/>
                    <span className="font-semibold text-red-600">交易磨损 = 4.8 USDT</span>
                  </div>
                  <div>
                    <strong className="text-orange-700">Gas磨损示例：</strong><br/>
                    BNB消耗：0.001 BNB<br/>
                    BNB价格：$600<br/>
                    <span className="font-semibold text-orange-600">Gas磨损 = 0.6 USDT</span>
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
                    <div className="text-gray-600">（次日8点前的最后状态）</div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                  <h4 className="font-semibold text-blue-700 mb-2">🎯 使用场景</h4>
                  <div className="text-sm space-y-1">
                    <div>• 积分计算的余额部分</div>
                    <div>• 钱包资产概览显示</div>
                    <div>• 磨损计算的基础数据</div>
                  </div>
                </div>
              </div>
            </div>

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
                      <div className="text-gray-600 mt-2">例：2025-06-10 表示<br/>6月10日8:00 ~ 6月11日7:59</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-indigo-700 mb-2">🔄 自动识别</h4>
                    <div className="text-sm space-y-1">
                      <div>• 系统自动识别当前所属日期</div>
                      <div>• 凌晨0:00-7:59属于前一天</div>
                      <div className="text-gray-600 mt-2">当前时间自动匹配对应的<br/>交易统计日期</div>
                    </div>
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

      {/* 网络配置弹窗 */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-normal">网络配置</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="rpc" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rpc">RPC节点</TabsTrigger>
              <TabsTrigger value="api">API配置</TabsTrigger>
            </TabsList>

            <TabsContent value="rpc" className="space-y-4">
              <div>
                <Label className="text-base font-normal">选择RPC节点</Label>
                <p className="text-sm text-gray-600 mb-3">选择一个稳定的BSC RPC节点</p>
                <Select
                  value={selectedRpcIndex.toString()}
                  onValueChange={(value) => setSelectedRpcIndex(Number.parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BSC_CONFIG.rpcUrls.map((url, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {url}
                      </SelectItem>
                    ))}
                    <SelectItem value={BSC_CONFIG.rpcUrls.length.toString()}>自定义节点</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRpcIndex === BSC_CONFIG.rpcUrls.length && (
                <div>
                  <Label htmlFor="customRpc">自定义RPC URL</Label>
                  <Input
                    id="customRpc"
                    placeholder="https://your-custom-rpc-url.com"
                    value={customRpcUrl}
                    onChange={(e) => setCustomRpcUrl(e.target.value)}
                    className="font-mono"
                  />
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">网络连接说明</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>连接失败原因：</strong>某些RPC节点可能有访问限制或临时维护</li>
                  <li>• <strong>自动重试：</strong>系统会自动尝试下一个可用节点</li>
                  <li>• <strong>推荐节点：</strong>Binance官方 {'>'}Ankr {'>'}NodeReal {'>'}自定义</li>
                  <li>• <strong>解决方案：</strong>如持续失败，请尝试切换网络或使用VPN</li>
                </ul>
              </div>
              
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handleRefreshNetwork} className="flex items-center gap-2">
                  <Loader2 className={`w-4 h-4 ${networkStatus === "connecting" ? "animate-spin" : ""}`} />
                  测试当前连接
                </Button>
                <Button onClick={() => setConfigModalOpen(false)}>
                  保存配置
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <div>
                <Label htmlFor="apiKey" className="text-base font-normal">
                  BSCScan API Key
                </Label>
                <p className="text-sm text-gray-600 mb-3">
                  用于获取完整的交易历史数据，
                  <a
                    href="https://bscscan.com/apis"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    点击获取免费API Key
                  </a>
                </p>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder="输入你的BSCScan API Key"
                    value={bscscanApiKey}
                    onChange={(e) => setBscscanApiKey(e.target.value)}
                    className="font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">API使用说明</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 免费账户：每秒5次请求，每天100,000次</li>
                  <li>• 已提供默认API Key，建议使用自己的</li>
                  <li>• 无API Key时仅能查询余额信息</li>
                </ul>
              </div>

            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 钱包管理弹窗 */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-normal">管理钱包</DialogTitle>
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
    </div>
  )
}
