import { NextRequest, NextResponse } from 'next/server'

// BSCScan API代理路由
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 提取所有查询参数
    const params = Object.fromEntries(searchParams.entries())
    
    // 验证必要参数
    if (!params.module || !params.action || !params.apikey) {
      return NextResponse.json(
        { error: '缺少必要参数: module, action, apikey' },
        { status: 400 }
      )
    }
    
    // 构建BSCScan API URL
    const bscscanUrl = new URL('https://api.bscscan.com/api')
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        bscscanUrl.searchParams.append(key, value)
      }
    })
    
    console.log(`🔄 代理BSCScan请求: ${params.module}/${params.action}`)
    
    // 发起请求到BSCScan API
    const response = await fetch(bscscanUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; BN-Alpha-Tool/1.0)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`BSCScan API请求失败: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // 返回BSCScan的响应数据
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
    
  } catch (error) {
    console.error('BSCScan代理请求失败:', error)
    
    return NextResponse.json(
      { 
        error: 'BSCScan代理请求失败', 
        details: error instanceof Error ? error.message : String(error),
        status: '0',
        message: 'NOTOK'
      },
      { status: 500 }
    )
  }
}

// 处理预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
} 