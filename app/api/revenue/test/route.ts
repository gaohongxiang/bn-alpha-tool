import { NextRequest, NextResponse } from 'next/server'
import { getEnvConfig } from '@/lib/core/config-manager'
import { tokenManager } from '@/lib/core/token-manager'
import { getHttpClient } from '@/lib/features/revenue/api-clients'

/**
 * 简化的收益分析测试 API
 * 用于逐步排查问题
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔥 测试API开始')
    
    const body = await request.json()
    console.log('📋 收到请求体:', body)
    
    const { walletAddresses, date } = body
    
    // 基本验证
    if (!walletAddresses || !Array.isArray(walletAddresses)) {
      return NextResponse.json({
        success: false,
        error: '钱包地址列表无效'
      }, { status: 400 })
    }
    
    if (!date) {
      return NextResponse.json({
        success: false,
        error: '日期无效'
      }, { status: 400 })
    }
    
    console.log('✅ 基本验证通过')
    
    // 测试环境变量
    const moralisKeys = []
    const keyNames = ['MORALIS_API_KEY_1', 'MORALIS_API_KEY_2', 'MORALIS_API_KEY_3']
    
    keyNames.forEach(keyName => {
      const key = process.env[keyName]
      if (key) {
        moralisKeys.push(keyName)
      }
    })
    
    console.log('🔑 找到API Keys:', moralisKeys)
    
    // 测试配置管理器
    try {
      const envConfig = getEnvConfig()
      console.log('⚙️ 配置管理器初始化成功，API Keys数量:', envConfig.moralisApiKeys.length)
    } catch (configError) {
      console.error('❌ 配置管理器失败:', configError)
      return NextResponse.json({
        success: false,
        error: '配置管理器初始化失败',
        details: configError instanceof Error ? configError.message : String(configError)
      }, { status: 500 })
    }

    // 测试代币管理器
    try {
      await tokenManager.initialize()
      console.log('🪙 代币管理器初始化成功')
    } catch (tokenError) {
      console.error('❌ 代币管理器失败:', tokenError)
      return NextResponse.json({
        success: false,
        error: '代币管理器初始化失败',
        details: tokenError instanceof Error ? tokenError.message : String(tokenError)
      }, { status: 500 })
    }

    // 测试HTTP客户端
    try {
      const httpClient = getHttpClient()
      console.log('🌐 HTTP客户端初始化成功')
    } catch (httpError) {
      console.error('❌ HTTP客户端失败:', httpError)
      return NextResponse.json({
        success: false,
        error: 'HTTP客户端初始化失败',
        details: httpError instanceof Error ? httpError.message : String(httpError)
      }, { status: 500 })
    }
    
    console.log('✅ 所有组件初始化成功')
    
    return NextResponse.json({
      success: true,
      message: '测试成功',
      data: {
        walletCount: walletAddresses.length,
        date: date,
        apiKeysCount: moralisKeys.length,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ 测试API失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
