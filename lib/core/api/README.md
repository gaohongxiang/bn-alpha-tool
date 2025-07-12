# 简化API系统架构说明

## 🎯 设计理念

这是一个简单实用的批量请求处理系统，专注于HTTP请求的批量处理。避免过度设计，保持简单易用。

## 📁 整体架构

```
lib/api/
├── core/                 # 核心层：基础设施
│   ├── types.ts         # 类型定义和错误类
│   ├── key-manager.ts   # API密钥管理
│   ├── request-queue.ts # 请求队列
│   ├── rate-limiter.ts  # 速率限制器
│   └── parallel-query.ts# 简化的并行查询管理器
├── cache/               # 缓存层
│   ├── memory-cache.ts  # 内存缓存
│   └── cache-manager.ts # 缓存管理器
├── clients/             # API客户端
│   └── http-client.ts   # HTTP API客户端
├── examples/            # 使用示例
└── index.ts            # 统一导出
```

## ✨ 核心功能

### 🌐 HTTP批量请求
- 支持GET/POST/PUT/DELETE等方法
- 智能并发控制和重试
- 进度回调和错误处理
- 简单易用的API

### 🔑 API Key管理
- 多API Key轮换
- 自动故障转移
- 智能重试机制

### 📦 缓存支持
- 内存缓存优化
- TTL过期管理
- LRU淘汰策略
- 简单的缓存API

## 🔧 核心组件详解

### 1. 增强类型系统 (types.ts)

```typescript
// 完整的API响应格式
interface APIResponse<T> {
    success: boolean
    data: T
    error?: {
        code: string | number
        message: string
        details?: any
    }
    timestamp: number
    metadata?: APIResponseMetadata
}

// 分层错误类型
class APIError extends Error {
    constructor(message: string, code: string | number, details?: any, isRetryable: boolean = true)
}
class RateLimitError extends APIError // 速率限制错误
class APIKeyError extends APIError    // API密钥错误
class TimeoutError extends APIError   // 超时错误
class NetworkError extends APIError   // 网络错误
```

### 2. 智能请求队列 (request-queue.ts)

**核心功能**:
- ✅ 优先级队列管理
- ✅ 智能超时处理
- ✅ 并发控制和限流
- ✅ 优雅关闭机制
- ✅ 详细状态监控

**优化特性**:
- 异步处理避免阻塞
- 超时处理器自动清理
- 错误分类和重试策略
- 内存泄漏防护

### 3. 令牌桶限流器 (rate-limiter.ts)

**核心算法**:
- 🪣 令牌桶算法实现
- ⚡ 平滑速率控制
- 🚀 突发请求支持
- 📊 实时统计监控

**高级特性**:
- 多资源独立限流
- 动态配置调整
- 等待执行机制
- 自动清理机制

### 4. 并行查询管理器 (parallel-query.ts)

**批处理能力**:
- 🔄 智能批次分组
- ⚡ 并发执行控制
- 📈 实时进度回调
- 🔁 失败重试机制

**资源管理**:
- API Key智能轮换
- 队列资源池化
- 优雅关闭支持
- 状态实时监控

## 💾 缓存系统

### 1. 内存缓存 (memory-cache.ts)

**核心功能**:
- 🕒 TTL过期管理
- 📏 大小限制控制
- 🏷️ 标签分组管理
- 📊 访问统计分析

**优化特性**:
- LRU淘汰策略
- 自动清理机制
- 命名空间隔离
- 详细统计信息

### 2. 缓存管理器 (cache-manager.ts)

**管理能力**:
- 🗂️ 多实例管理
- 🏷️ 标签批量操作
- 📊 全局统计监控
- 🧹 统一清理机制

**预定义缓存**:
- `apiCache`: API响应缓存 (3分钟)
- `balanceCache`: 余额数据缓存 (2分钟)
- `transactionCache`: 交易历史缓存 (10分钟)
- `priceCache`: 价格数据缓存 (1分钟)

## 🌐 业务层优化

### 1. 增强Moralis客户端 (client.ts)

**核心改进**:
- ✅ 地址验证和预处理
- ✅ 详细错误分类处理
- ✅ 响应元数据提取
- ✅ 健康检查机制
- ✅ 优雅关闭支持

**API方法**:
- `getWalletTransactions()`: 获取钱包交易
- `getTokenBalances()`: 获取代币余额
- `getTokenPrice()`: 获取代币价格
- `batchGetTransactions()`: 批量获取交易
- `batchGetTokenBalances()`: 批量获取余额
- `healthCheck()`: 健康检查

## 🚀 快速开始

### 1. HTTP批量请求

```typescript
import { batchHttpRequests } from '@/lib/api'

const requests = [
    { url: 'https://api.example.com/data/1' },
    { url: 'https://api.example.com/data/2' },
    {
        url: 'https://api.example.com/data',
        method: 'POST',
        body: { name: 'test' }
    }
]

const results = await batchHttpRequests(requests, {
    batchSize: 3,
    concurrency: 2,
    retryAttempts: 3,
    progressCallback: (progress, completed, total) => {
        console.log(`进度: ${progress.toFixed(1)}% (${completed}/${total})`)
    },
    onSuccess: (data, config, index) => {
        console.log(`✅ ${config.url} 成功`)
    },
    onError: (error, config, index) => {
        console.log(`❌ ${config.url} 失败: ${error.message}`)
    }
})
```

### 2. 调用区块链API

```typescript
import { createHttpClient } from '@/lib/api'

const client = createHttpClient({
    apiKeys: ['your-moralis-api-key-1', 'your-moralis-api-key-2']
})

// 调用 Moralis API
const response = await client.get('https://deep-index.moralis.io/api/v2.2/0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6/balance?chain=0x38')

if (response.ok) {
    const data = await response.json()
    console.log('钱包余额:', data)
} else {
    console.error('请求失败:', response.status)
}
```

### 3. 缓存优化

```typescript
import { balanceCache } from '@/lib/api'

// 检查缓存
const cacheKey = `balance:${address}:bsc`
let data = balanceCache.get(cacheKey)

if (!data) {
    // 从API获取
    const result = await client.getTokenBalances(address, 'bsc')
    if (result.success) {
        // 缓存结果
        balanceCache.set(cacheKey, result.data, 120000) // 2分钟
        data = result.data
    }
}
```

## 错误处理

系统实现了完整的错误处理机制：

1. API错误
```typescript
throw new APIError('Request failed', 'RATE_LIMIT_ERROR', {
    retryAfter: 1000
})
```

2. 速率限制
```typescript
throw new RateLimitError('Rate limit exceeded', 1000)
```

3. 请求超时
```typescript
throw new TimeoutError('Request timeout', {
    timeout: 5000
})
```

## 性能优化

1. 并行请求
- 自动批处理
- 智能并发控制
- 失败重试

2. 缓存策略
- 内存缓存
- 响应缓存
- 配置缓存

3. 速率优化
- API密钥轮换
- 动态并发调整
- 请求优先级

## 最佳实践

1. 配置管理
```typescript
const config: APIConfig = {
    apiKeys: process.env.API_KEYS.split(','),
    rateLimit: {
        maxRequests: 100,
        interval: 60000
    },
    timeout: 5000
}
```

2. 错误处理
```typescript
try {
    const result = await client.query()
} catch (error) {
    if (error instanceof RateLimitError) {
        // 处理速率限制
    } else if (error instanceof TimeoutError) {
        // 处理超时
    }
}
```

3. 批量查询
```typescript
const results = await parallelQuery.executeParallel(
    queries,
    {
        batchSize: 10,
        retryAttempts: 3
    }
)
```

## 注意事项

1. API密钥管理
- 不要硬编码API密钥
- 使用环境变量
- 定期轮换密钥

2. 错误处理
- 始终捕获异常
- 实现优雅降级
- 记录错误日志

3. 性能优化
- 合理设置批量大小
- 监控API使用情况
- 优化并发参数 