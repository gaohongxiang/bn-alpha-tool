// 调试API管理器状态
console.log('=== API管理器调试 ===')

// 模拟浏览器环境
global.window = {}
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}
global.fetch = require('node-fetch')

// 导入API管理器
const { APIManager } = require('./components/api-manager.ts')

async function debugAPIManager() {
  try {
    const apiManager = new APIManager()
    
    console.log('1. 等待初始化...')
    await apiManager.waitForInitialization()
    
    console.log('2. 获取API统计...')
    const stats = apiManager.getAPIStats()
    console.log('API统计:', stats)
    
    console.log('3. 获取当前网络配置...')
    const config = apiManager.getCurrentNetworkConfig()
    console.log('网络配置:', JSON.stringify(config, null, 2))
    
    console.log('4. 测试API请求...')
    const response = await apiManager.makeRequest('bsc', 'bscscan', '', {
      module: 'account',
      action: 'balance',
      address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      tag: 'latest'
    })
    
    console.log('API请求结果:', response)
    
  } catch (error) {
    console.error('调试失败:', error)
  }
}

debugAPIManager() 