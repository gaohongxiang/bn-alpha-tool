import { NextRequest, NextResponse } from 'next/server'

/**
 * 测试环境变量配置的 API
 */
export async function GET(request: NextRequest) {
  try {
    // 检查 Moralis API Keys
    const moralisKeys = []
    const keyNames = ['MORALIS_API_KEY_1', 'MORALIS_API_KEY_2', 'MORALIS_API_KEY_3']
    
    keyNames.forEach(keyName => {
      const key = process.env[keyName]
      if (key) {
        moralisKeys.push({
          name: keyName,
          length: key.length,
          prefix: key.substring(0, 8) + '...'
        })
      }
    })

    // 检查其他环境变量
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      moralisKeysCount: moralisKeys.length,
      moralisKeys: moralisKeys
    }

    return NextResponse.json({
      success: true,
      environment: envInfo,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('环境变量测试失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
