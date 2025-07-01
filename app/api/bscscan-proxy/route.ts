import { NextRequest, NextResponse } from 'next/server'

// BSCScan API代理路由 - 使用新的服务架构
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 提取所有查询参数
    const params = Object.fromEntries(searchParams.entries())
    
    // 验证必要参数 (新架构不需要apikey，由服务内部管理)
    if (!params.module || !params.action) {
      return NextResponse.json(
        { error: '缺少必要参数: module, action' },
        { status: 400 }
      )
    }
    
    console.log(`🔄 代理BSCScan请求: ${params.module}/${params.action}`)
    
    // 动态导入BSCScan服务
    const { BSCScanService } = await import('@/services/api/bscscan-service')
    const bscscanService = BSCScanService.getInstance()
    
    // 移除apikey参数（由服务内部管理）
    const { apikey, ...serviceParams } = params
    
    // 使用新的BSCScan服务执行请求
    const response = await bscscanService.makeRequest(serviceParams)
    
    if (!response.success) {
      // 检查是否为速率限制错误
      const isRateLimit = response.error?.includes('rate limit') || 
                         response.error?.includes('requests per sec') ||
                         response.error?.includes('Max calls per sec')
      
      if (isRateLimit) {
        return NextResponse.json({
          status: '0',
          message: 'NOTOK',
          result: response.error,
          proxyNote: `BSCScan API速率限制: ${response.error}`,
          isRateLimit: true
        }, {
          status: 429,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Retry-After': '2'
          }
        })
      }
      
      // 其他错误
      return NextResponse.json({
        status: '0',
        message: 'NOTOK',
        result: response.error,
        proxyNote: `BSCScan API错误: ${response.error}`
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      })
    }
    
    // 返回成功响应
    return NextResponse.json(response.data, {
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