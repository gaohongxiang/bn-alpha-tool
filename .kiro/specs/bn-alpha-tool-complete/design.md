# BN Alpha Tool - 设计文档

## 系统架构概览

BN Alpha Tool 采用现代化的分层架构设计，基于 Next.js 14 App Router，结合 TypeScript 类型安全和模块化组件设计，实现高性能的区块链数据分析功能。

## 技术栈选择

### 前端技术栈
- **Next.js 14**: 使用最新的 App Router，支持 Server Components 和 Client Components
- **React 18**: 现代化的 React 开发，支持并发特性
- **TypeScript**: 完整的类型安全保障
- **Tailwind CSS**: 原子化 CSS 框架，快速构建响应式界面
- **shadcn/ui**: 基于 Radix UI 的高质量组件库
- **Zustand**: 轻量级状态管理
- **Recharts**: 数据可视化图表库

### 后端技术栈
- **Next.js API Routes**: 服务端 API 处理
- **Moralis API**: 区块链数据查询服务
- **ethers.js**: 以太坊交互库
- **Winston**: 结构化日志记录

## 架构设计

### 1. 分层架构

```
┌─────────────────────────────────────────────┐
│              表现层 (Presentation)           │
│  Next.js App Router + React Components     │
├─────────────────────────────────────────────┤
│              API路由层 (API Routes)         │
│  Next.js API Routes + 请求处理             │
├─────────────────────────────────────────────┤
│              业务逻辑层 (Business Logic)     │
│  Revenue Analysis + Points + Airdrop       │
├─────────────────────────────────────────────┤
│              核心服务层 (Core Services)      │
│  API Client + Config + Logger + Utils      │
├─────────────────────────────────────────────┤
│              数据访问层 (Data Access)        │
│  Moralis API + HTTP Client + Cache         │
└─────────────────────────────────────────────┘
```

### 2. 模块化设计

#### 核心模块 (lib/core/)
- **API系统**: 统一的HTTP客户端，支持多API密钥轮换、速率限制、重试机制
- **配置管理**: 智能动态配置，零配置文件设计
- **日志系统**: 结构化日志记录，支持不同级别和输出格式
- **工具函数**: 通用工具函数和类型定义

#### 业务模块 (lib/features/)
- **收益分析**: 钱包余额查询、交易分析、积分计算
- **积分计算**: 积分规则引擎、预估计算器
- **空投管理**: 空投数据管理、状态跟踪、历史记录

#### 组件模块 (components/)
- **UI组件**: 基于shadcn/ui的可复用组件
- **业务组件**: 特定功能的复合组件
- **布局组件**: 页面布局和导航组件

## 核心功能设计

### 1. 钱包收益分析系统

#### 数据流设计
```
用户输入 → 地址验证 → 时间范围计算 → 区块范围获取 → 并行数据查询 → 结果计算 → 界面展示
```

#### 并行查询架构
```typescript
// 并行执行两个主要任务
const [balanceAnalysis, transactionData] = await Promise.all([
  // 任务1: 代币余额查询 + 价值计算
  TokenService.getTokenBalances(address, tokenData),
  // 任务2: 交易历史查询 + 磨损计算  
  TransactionService.getWalletTransactions(address, tokenData)
])
```

#### 核心算法

**交易磨损计算（含未完成交易处理）**:
```typescript
// 改进后的算法：处理未完成交易，只计算完整交易对
const buyTransactions = allTransactions.filter(tx => tx.transactionType === 'buy')
const sellTransactions = allTransactions.filter(tx => tx.transactionType === 'sell')

// 处理未完成交易：如果最后一笔是买入且买入数量比卖出多，则忽略最后一笔买入
let completeBuyTransactions = buyTransactions
let ignoredBuyValue = 0

if (allTransactions.length > 0) {
  const lastTransaction = allTransactions[allTransactions.length - 1]
  if (lastTransaction.transactionType === 'buy' && buyTransactions.length > sellTransactions.length) {
    // 忽略最后一笔未完成的买入交易
    completeBuyTransactions = buyTransactions.slice(0, -1)
    ignoredBuyValue = lastTransaction.totalValueUsd
  }
}

// 计算完整交易的磨损
const completeBuyValue = completeBuyTransactions.reduce((sum, tx) => sum + tx.totalValueUsd, 0)
const totalSellValue = sellTransactions.reduce((sum, tx) => sum + tx.totalValueUsd, 0)

// 修复后的正确算法：使用实际的 USDT 流入流出
// 买入交易：花费的 USDT（sold.usdAmount 的绝对值）
const totalUsdtSpent = completeBuyTransactions.reduce((sum, tx) => {
  return sum + Math.abs(tx.sold?.usdAmount || 0)
}, 0)

// 卖出交易：得到的 USDT（bought.usdAmount）
const totalUsdtReceived = sellTransactions.reduce((sum, tx) => {
  return sum + (tx.bought?.usdAmount || 0)
}, 0)

// 交易磨损 = 花费的 USDT - 得到的 USDT
const tradingLoss = totalUsdtSpent - totalUsdtReceived

// 日志记录
console.log(`交易磨损: $${tradingLoss.toFixed(2)} (完整买入: $${completeBuyValue.toFixed(2)} - 卖出总计: $${totalSellValue.toFixed(2)})${ignoredBuyValue > 0 ? ` [忽略未完成: $${ignoredBuyValue.toFixed(2)}]` : ''}`)
```

**有效交易识别算法**:
```typescript
// 1. 基于配置的交易对过滤
const filterValidTransactions = (transactions: any[], tokenData: TokenDataOfNetwork) => {
  // 获取配置中支持的交易对
  const availablePairs = Object.keys(tokenData.pairs)
  
  // 过滤符合配置的交易 - 直接比较pairLabel
  const validTransactions = transactions.filter((txData: any) => {
    return tokenData.pairs.hasOwnProperty(txData.pairLabel)
  })
  
  logger.debug('general', `📊 所有交易: ${validTransactions.length} 笔`)
  return validTransactions
}

// 2. 买入交易识别和统计
const analyzeBuyTransactions = (allTransactions: any[], tokenData: TokenDataOfNetwork) => {
  // 只统计买入交易作为有效交易
  const buyTransactions = allTransactions.filter((tx: any) => tx.transactionType === 'buy')
  
  // 计算有效交易总价值，应用volumeMultiplier
  const totalBoughtValue = buyTransactions.reduce((sum: number, tx: any) => 
    sum + tx.bought.usdAmount, 0
  ) * tokenData.volumeMultiplier
  
  logger.debug('general', `📈 有效交易: ${buyTransactions.length} 笔`)
  logger.debug('general', `💰 有效交易总价值: $${totalBoughtValue.toFixed(2)}`)
  
  return {
    buyTransactionsCount: buyTransactions.length,
    totalBoughtValue,
    buyTransactions: buyTransactions.map(tx => ({
      transactionHash: tx.transactionHash,
      pairLabel: tx.pairLabel,
      buySymbol: tx.bought.symbol,
      sellSymbol: tx.sold.symbol,
      buyAmount: tx.bought.amount,
      sellAmount: tx.sold.amount,
      time: formatTime(tx.blockTimestamp),
      totalValueUsd: tx.totalValueUsd
    }))
  }
}
```

**交易量计算规则**:
- **有效交易定义**: 只有买入交易(transactionType === 'buy')计入有效交易
- **交易对过滤**: 基于配置文件中的pairs字段，只统计指定交易对(如USDT/ZKJ、ZKJ/KOGE等)
- **交易量计算**: 使用bought.usdAmount × volumeMultiplier
- **BSC链加成**: volumeMultiplier = 2，其他链为1
- **积分计算**: 基于totalBoughtValue计算交易积分，BSC链自动翻倍

**未完成交易处理逻辑**:
- **检测条件**: 最后一笔交易为买入 && 买入笔数 > 卖出笔数
- **处理方式**: 忽略最后一笔买入交易，只计算完整配对的交易
- **边界情况**: 
  - 只有买入没有卖出 → 磨损为0
  - 买卖完全配对 → 正常计算
  - 卖出比买入多 → 正常计算（可能是之前持有的代币）

**积分计算规则**:
```typescript
// 余额积分：基于USDT总价值
const balancePoints = Math.floor(totalUsdtValue / 100) * 10

// 交易积分：基于有效交易量，BSC链翻倍
const volumePoints = Math.floor(totalVolume / 1000) * 5
const finalVolumePoints = isMainnet ? volumePoints * 2 : volumePoints

const totalPoints = balancePoints + finalVolumePoints
```

### 2. API系统设计

#### 多API密钥管理
```typescript
class APIKeyManager {
  private keys: APIKey[]
  private currentIndex: number
  
  // 智能轮换策略
  getNextAvailableKey(): APIKey {
    // 检查当前密钥状态
    // 自动故障转移
    // 负载均衡分配
  }
  
  // 健康检查
  async checkKeyHealth(key: APIKey): Promise<boolean>
}
```

#### 并发控制和重试机制
```typescript
class ParallelQueryManager {
  private maxConcurrency = 30
  private retryAttempts = 3
  
  async executeBatch<T>(requests: RequestFunction<T>[]): Promise<T[]> {
    // 批量处理请求
    // 控制并发数量
    // 失败重试机制
    // 进度跟踪
  }
}
```

### 3. 缓存策略设计

#### 多层缓存架构
```typescript
// L1: 内存缓存
class MemoryCache {
  private cache = new Map<string, CacheItem>()
  
  set(key: string, value: any, ttl: number): void
  get(key: string): any | null
  clear(): void
}

// L2: 浏览器缓存
class BrowserCache {
  setItem(key: string, value: any, expiry?: number): void
  getItem(key: string): any | null
}
```

#### 缓存策略
- **代币价格**: 10分钟TTL，全局共享
- **区块范围**: 1小时TTL，按日期缓存
- **钱包余额**: 5分钟TTL，按地址缓存
- **交易数据**: 30分钟TTL，按地址和时间范围缓存

### 4. 空投管理系统

#### 数据模型设计
```typescript
interface AirdropItem {
  date: string
  token: string
  points: number
  participants: number | null
  amount: number | string
  supplementaryToken: number | string
  currentPrice: string | null
  type: "airdrop" | "tge" | "preTge" | "bondingCurveTge"
  cost?: number
  pointsConsumed?: boolean
  
  // 时间字段 - 有此字段则显示在提醒中
  startTime?: string
  phase1Points?: number
  phase2Points?: number
  phase1EndTime?: string
  phase2EndTime?: string
  endTime?: string
}
```

#### 状态判断逻辑
```typescript
// 基于startTime字段判断是否为当前空投
const currentAirdrops = allData.filter(item => item.startTime)
const historyData = allData.filter(item => !item.startTime)

// 支持两种时间格式
const parseUTC8Time = (timeStr: string): Date => {
  // 完整时间: "2025-07-24 20:00 (UTC+8)"
  // 仅日期: "2025-07-24" -> 显示"今日开放"
}
```

### 5. 用户界面设计

#### 响应式布局
```typescript
// 主布局结构
<div className="flex flex-col min-h-screen">
  <Sidebar /> {/* 侧边导航 */}
  <main className="flex-1">
    {renderContent()} {/* 动态内容区域 */}
  </main>
</div>
```

#### 交易详情模态框设计
```typescript
interface TransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletAddress: string
  selectedDate: string
  transactions: Transaction[]
  isLoading: boolean
}

// 交易详情展示组件
const TransactionModal = ({ transactions, walletAddress }: TransactionModalProps) => {
  return (
    <Dialog>
      <DialogContent className="max-w-6xl">
        {/* 交易列表表格 */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>交易哈希</TableHead>
              <TableHead>交易对</TableHead>
              <TableHead>交易数量</TableHead>
              <TableHead>USDT价值</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map(tx => (
              <TableRow key={tx.hash}>
                {/* 交易详情行 */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* 交易统计信息 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4>交易统计</h4>
          <div className="grid grid-cols-4 gap-4">
            <div>总交易量: ${totalVolume}</div>
            <div>平均交易额: ${avgAmount}</div>
            <div>交易次数: {count}</div>
            <div>BSC积分加成: 2倍</div>
          </div>
        </div>
        
        {/* 积分等级指导 */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h4>积分等级指导</h4>
          <div className="space-y-2">
            <div>当前交易积分: {currentPoints} 分</div>
            <div>当前等级: {currentLevel}</div>
            <div>下一等级所需积分: {nextLevelPoints} 分</div>
            <div>还需交易量: ${remainingVolume} (考虑BSC 2倍加成)</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### 积分等级计算逻辑
```typescript
// 积分等级计算器
class PointsLevelCalculator {
  // 积分等级对照表
  private static LEVEL_THRESHOLDS = [
    { level: 1, minPoints: 0, maxPoints: 49 },
    { level: 2, minPoints: 50, maxPoints: 99 },
    { level: 3, minPoints: 100, maxPoints: 199 },
    { level: 4, minPoints: 200, maxPoints: 299 },
    { level: 5, minPoints: 300, maxPoints: 499 },
    { level: 6, minPoints: 500, maxPoints: 999 },
    { level: 7, minPoints: 1000, maxPoints: Infinity }
  ]
  
  // 计算当前等级
  static getCurrentLevel(points: number): number {
    const level = this.LEVEL_THRESHOLDS.find(l => 
      points >= l.minPoints && points <= l.maxPoints
    )
    return level?.level || 1
  }
  
  // 计算距离下一等级所需的交易量
  static getRequiredVolumeForNextLevel(currentPoints: number, isBSC: boolean = true): {
    nextLevel: number
    requiredPoints: number
    requiredVolume: number
    isMaxLevel: boolean
  } {
    const currentLevel = this.getCurrentLevel(currentPoints)
    const nextLevelThreshold = this.LEVEL_THRESHOLDS.find(l => l.level === currentLevel + 1)
    
    if (!nextLevelThreshold) {
      return {
        nextLevel: currentLevel,
        requiredPoints: 0,
        requiredVolume: 0,
        isMaxLevel: true
      }
    }
    
    const requiredPoints = nextLevelThreshold.minPoints - currentPoints
    // 交易积分计算：每1000 USDT = 5分，BSC链翻倍
    const baseMultiplier = isBSC ? 10 : 5 // BSC链每1000 USDT = 10分
    const requiredVolume = (requiredPoints / baseMultiplier) * 1000
    
    return {
      nextLevel: nextLevelThreshold.level,
      requiredPoints,
      requiredVolume,
      isMaxLevel: false
    }
  }
}
```

#### 磨损详情展示设计
```typescript
// 磨损详情组件
const LossDetailsModal = ({ transactionData }: { transactionData: TransactionSummary }) => {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>磨损详情分析</DialogTitle>
        </DialogHeader>
        
        {/* 交易磨损详情 */}
        <div className="space-y-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <h4 className="text-red-800 font-semibold">交易磨损详情</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>所有买入交易总价值:</span>
                <span className="font-medium">${totalBuyValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>所有卖出交易总价值:</span>
                <span className="font-medium">${totalSellValue.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-red-600">
                <span>交易磨损 (买入 - 卖出):</span>
                <span>${transactionData.allTransactionLossValue.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {/* Gas磨损详情 */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-orange-800 font-semibold">Gas费磨损详情</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>交易笔数:</span>
                <span className="font-medium">{transactionData.allTransactionsCount} 笔</span>
              </div>
              <div className="flex justify-between">
                <span>单笔平均Gas费:</span>
                <span className="font-medium">${(transactionData.allGasLossValue / transactionData.allTransactionsCount).toFixed(4)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-orange-600">
                <span>总Gas费磨损:</span>
                <span>${transactionData.allGasLossValue.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {/* 总磨损汇总 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between font-bold text-lg">
              <span>总磨损:</span>
              <span className="text-red-600">
                ${(transactionData.allTransactionLossValue + transactionData.allGasLossValue).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### 状态管理
```typescript
// 使用Zustand进行状态管理
interface UIStore {
  activeTab: string
  setActiveTab: (tab: string) => void
  transactionModalOpen: boolean
  setTransactionModalOpen: (open: boolean) => void
  lossDetailsModalOpen: boolean
  setLossDetailsModalOpen: (open: boolean) => void
}

interface WalletStore {
  wallets: WalletInput[]
  walletData: WalletData[]
  hasQueried: boolean
  selectedTransactions: Transaction[]
  setWallets: (wallets: WalletInput[]) => void
  setWalletData: (data: WalletData[]) => void
  setHasQueried: (queried: boolean) => void
  setSelectedTransactions: (transactions: Transaction[]) => void
}
```

## 数据模型设计

### 核心数据类型

#### 钱包数据
```typescript
interface WalletData {
  address: string
  note?: string
  tokensValue: number
  totalBalance?: number
  tokenBalances?: TokenBalance[]
  transactionData?: TransactionSummary
  points: number
  balancePoints: number
  volumePoints: number
  error?: string
}
```

#### 交易数据
```typescript
interface TransactionSummary {
  allTransactionsCount: number
  allTransactionLossValue: number
  allGasLossValue: number
  buyTransactionsCount: number
  buyTransactions: BuyTransaction[]
  totalBoughtValue: number
  hasApiError?: boolean
  errorMessage?: string
}
```

#### API响应格式
```typescript
interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  responseTime?: number
  keyUsed?: string
}
```

## 错误处理设计

### 错误分类和处理策略

#### API错误处理
```typescript
class APIErrorHandler {
  static handle(error: APIError): ErrorResponse {
    switch (error.type) {
      case 'RATE_LIMIT':
        return { retry: true, delay: 1000 }
      case 'INVALID_KEY':
        return { switchKey: true }
      case 'NETWORK_ERROR':
        return { retry: true, delay: 5000 }
      default:
        return { fail: true, message: error.message }
    }
  }
}
```

#### 用户友好的错误信息
```typescript
const ERROR_MESSAGES = {
  INVALID_ADDRESS: '钱包地址格式不正确，请检查后重试',
  API_LIMIT_EXCEEDED: 'API调用频率过高，请稍后重试',
  NETWORK_ERROR: '网络连接异常，请检查网络后重试',
  DATA_NOT_FOUND: '未找到相关数据，请确认地址和日期是否正确'
}
```

## 性能优化设计

### 1. 前端性能优化

#### 组件优化
```typescript
// 使用React.memo防止不必要的重渲染
const WalletCard = React.memo(({ wallet }: { wallet: WalletData }) => {
  return <div>{/* 钱包卡片内容 */}</div>
})

// 使用useMemo缓存计算结果
const totalValue = useMemo(() => {
  return walletData.reduce((sum, wallet) => sum + wallet.tokensValue, 0)
}, [walletData])
```

#### 代码分割和懒加载
```typescript
// 动态导入大型组件
const HistoryChart = dynamic(() => import('./history-chart'), {
  loading: () => <div>加载中...</div>
})
```

### 2. 后端性能优化

#### 并发处理
```typescript
// 批量并行处理钱包
const results = await Promise.allSettled(
  walletAddresses.map(address => 
    analyzeWallet(address, dateStr)
  )
)
```

#### 智能缓存
```typescript
// 缓存键策略
const getCacheKey = (address: string, date: string): string => {
  return `wallet:${address}:${date}`
}

// 缓存失效策略
const shouldRefreshCache = (cacheTime: number): boolean => {
  return Date.now() - cacheTime > CACHE_TTL
}
```

## 安全性设计

### 1. 输入验证
```typescript
// 钱包地址验证
const validateWalletAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// 日期格式验证
const validateDateFormat = (date: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}
```

### 2. API密钥保护
```typescript
// 环境变量管理
const getAPIKeys = (): string[] => {
  const keys = [
    process.env.MORALIS_API_KEY_1,
    process.env.MORALIS_API_KEY_2,
    process.env.MORALIS_API_KEY_3
  ].filter(Boolean)
  
  if (keys.length === 0) {
    throw new Error('No API keys configured')
  }
  
  return keys
}
```

### 3. 速率限制
```typescript
class RateLimiter {
  private requests: number[] = []
  private maxRequests = 30
  private timeWindow = 1000 // 1秒
  
  async checkLimit(): Promise<boolean> {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.timeWindow)
    
    if (this.requests.length >= this.maxRequests) {
      return false
    }
    
    this.requests.push(now)
    return true
  }
}
```

## 监控和日志设计

### 日志系统
```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  category: string
  message: string
  timestamp: number
  metadata?: any
}

class Logger {
  static debug(category: string, message: string, metadata?: any): void
  static info(category: string, message: string, metadata?: any): void
  static warn(category: string, message: string, metadata?: any): void
  static error(category: string, message: string, metadata?: any): void
}
```

### 性能监控
```typescript
class PerformanceMonitor {
  static startTimer(operation: string): string
  static endTimer(timerId: string): number
  static recordAPICall(endpoint: string, duration: number, success: boolean): void
  static getMetrics(): PerformanceMetrics
}
```

## 部署和运维设计

### 环境配置
```bash
# 生产环境变量
NODE_ENV=production
MORALIS_API_KEY_1=xxx
MORALIS_API_KEY_2=xxx
MORALIS_API_KEY_3=xxx
LOG_LEVEL=info
```

### 构建优化
```typescript
// next.config.mjs
const nextConfig = {
  experimental: {
    appDir: true
  },
  images: {
    domains: ['example.com']
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY
  }
}
```

这个设计文档涵盖了系统的核心架构、关键算法、性能优化策略和安全考虑，为开发团队提供了完整的技术实现指导。