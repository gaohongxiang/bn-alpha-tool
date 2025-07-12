/**
 * 代币管理器
 * 只负责网络和代币数据配置
 */

import { readFile } from 'fs/promises'
import { join } from 'path'

// ==================== 类型定义 ====================

// 原始配置文件的类型
interface RawTokenConfig {
  symbol: string
  address: string
  decimals?: number
  description?: string
}

interface RawPairsConfig {
  baseToken: RawTokenConfig
  targetTokens: RawTokenConfig[]
}

interface RawNetworkConfig {
  name: string
  chainId: number
  nativeToken: RawTokenConfig
  pairs: RawPairsConfig
  rules: {
    volumeMultiplier: number
  }
}

interface RawAppConfig {
  networks: {
    [networkId: string]: RawNetworkConfig
  }
}

// 优化后的分离式结构类型
export interface TokenInfo {
  symbol: string
  address: string
  decimals?: number
  price?: number
}

// 区块范围信息接口
export interface BlockRangeInfo {
  startBlock: number
  endBlock: number
  startISO: string
  endISO: string
}

// 每个网络的代币数据 - 包含代币信息、交易对等
export interface TokenDataOfNetwork {
  network: string
  chainId: string
  chainIdHex: string
  volumeMultiplier: number
  
  // 代币数据
  nativeToken: TokenInfo
  erc20Tokens: Record<string, TokenInfo>
  
  pairs: {
    [pairKey: string]: {
      [symbol: string]: string
    }
  }
  
  // 动态区块范围缓存
  blockRanges?: BlockRangeInfo
}

export interface AppConfig {
  networks: {
    [networkId: string]: TokenDataOfNetwork
  }
}

// ==================== 代币管理器 ====================

class TokenManager {
  private static instance: TokenManager
  private config: AppConfig | null = null
  private rawConfig: RawAppConfig | null = null
  private readonly CONFIG_PATH = '/config/tokens.json'

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager()
    }
    return TokenManager.instance
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 初始化代币配置...')
      await this.loadConfig()
      console.log('✅ 代币配置初始化完成')
    } catch (error) {
      console.error('❌ 代币配置初始化失败:', error)
      throw error
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      let configData: string

      // 检查是否在浏览器环境
      if (typeof window !== 'undefined') {
        const response = await fetch(this.CONFIG_PATH)
        if (!response.ok) {
          throw new Error(`配置文件加载失败: ${response.status}`)
        }
        configData = await response.text()
      } else {
        // 使用顶层静态导入
        const configPath = join(process.cwd(), 'public', this.CONFIG_PATH)
        configData = await readFile(configPath, 'utf-8')
      }

      this.rawConfig = JSON.parse(configData) as RawAppConfig
      console.log(`📋 配置加载成功`)
    } catch (error) {
      console.error('配置文件加载失败:', error)
      throw error
    }
  }

  // ==================== 基础配置获取 ====================

  getConfig(): AppConfig {
    if (!this.rawConfig) {
      throw new Error('配置未初始化，请先调用 initialize()')
    }
    
    // 转换所有代币网络数据
    const networks = this.getTokenDataOfNetwork()

    return {
      networks,
    }
  }

  /**
   * 获取每个网络的代币数据 - 转换为分离式结构
   */
  getTokenDataOfNetwork(): { [networkId: string]: TokenDataOfNetwork } {
    if (!this.rawConfig) {
      throw new Error('配置未初始化，请先调用 initialize()')
    }

    const allTokenDataOfNetworks: { [networkId: string]: TokenDataOfNetwork } = {}
    
    Object.keys(this.rawConfig.networks).forEach(networkId => {
      const rawNetwork = this.rawConfig!.networks[networkId]
      
      // 构建原生代币信息 - 包含decimals字段
      const nativeToken: TokenInfo = {
        symbol: rawNetwork.nativeToken.symbol,
        address: rawNetwork.nativeToken.address.toLowerCase(),
        decimals: rawNetwork.nativeToken.decimals
      }

      // 构建ERC20代币列表
      const erc20Tokens: Record<string, TokenInfo> = {}
      
      // 添加基础代币 (USDT等，配置文件中没有decimals，代码中默认18位)
      const baseToken = rawNetwork.pairs.baseToken
      const baseTokenInfo: TokenInfo = {
        symbol: baseToken.symbol,
        address: baseToken.address.toLowerCase()
      }
      erc20Tokens[baseToken.symbol] = baseTokenInfo

      // 添加目标代币
      rawNetwork.pairs.targetTokens.forEach(token => {
        const tokenInfo: TokenInfo = {
          symbol: token.symbol,
          address: token.address.toLowerCase()
        }
        erc20Tokens[token.symbol] = tokenInfo
      })

      // 构建简化的交易对结构
      const pairs: { [pairKey: string]: { [symbol: string]: string } } = {}
      
      rawNetwork.pairs.targetTokens.forEach(targetToken => {
        // 只存储 targetToken/baseToken 格式（如 BR/USDT）
        const pairKey = `${targetToken.symbol}/${baseToken.symbol}`
        pairs[pairKey] = {
          [targetToken.symbol]: targetToken.address.toLowerCase(),
          [baseToken.symbol]: baseToken.address.toLowerCase()
        }
      })

      allTokenDataOfNetworks[networkId] = {
        network: networkId,
        chainId: rawNetwork.chainId.toString(),
        chainIdHex: `0x${rawNetwork.chainId.toString(16)}`,
        volumeMultiplier: rawNetwork.rules.volumeMultiplier,
        nativeToken,
        erc20Tokens,
        pairs
      }
    })

    return allTokenDataOfNetworks
  }
}

// 导出单例实例
export const tokenManager = TokenManager.getInstance()
export default tokenManager

// 测试代码（生产环境中已禁用）
// 如需测试，请运行: NODE_ENV=development npx tsx lib/config-manager.ts

async function test() {
  await tokenManager.initialize()
  const tokenDataOfNetworks = tokenManager.getTokenDataOfNetwork()
  console.log('每个网络的代币数据:')
  console.log(JSON.stringify(tokenDataOfNetworks.bsc, null, 2))
}

test()