import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Eye, EyeOff, CheckCircle, AlertCircle, Activity } from "lucide-react"
import { apiManager } from "@/components/api-manager"

interface APIConfigPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function APIConfigPanel({ open, onOpenChange }: APIConfigPanelProps) {
  const [newApiKey, setNewApiKey] = useState("")
  const [newApiName, setNewApiName] = useState("")
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({})
  const [apiStats, setApiStats] = useState({
    totalKeys: 0,
    activeKeys: 0,
    healthyKeys: 0,
    currentNetwork: 'bsc',
    requestsPerSecond: 0
  })



  const [currentApiKeys, setCurrentApiKeys] = useState<Array<{
    key: string
    name: string
    active: boolean
    priority: number
    comment?: string
    isDefault?: boolean
    protected?: boolean
  }>>([])

  // 刷新数据的函数
  const refreshData = () => {
    const stats = apiManager.getAPIStats()
    setApiStats(stats)
    
    const config = apiManager.getCurrentNetworkConfig()
    if (config?.apis.bscscan) {
      setCurrentApiKeys([...config.apis.bscscan.keys])
      console.log('🔍 API配置面板刷新数据:', {
        totalKeys: config.apis.bscscan.keys.length,
        keys: config.apis.bscscan.keys.map(k => ({
          name: k.name,
          isDefault: k.isDefault,
          protected: k.protected,
          active: k.active
        }))
      })
    } else {
      console.log('❌ 未找到BSCScan配置')
    }
  }

  useEffect(() => {
    if (open) {
      // 延迟一点获取数据，确保APIManager初始化完成
      const timer = setTimeout(() => {
        refreshData()
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleAddApiKey = () => {
    if (!newApiKey.trim() || !newApiName.trim()) {
      return
    }

    const success = apiManager.addAPIKey('bsc', 'bscscan', newApiKey, newApiName)
    
    if (success) {
      // 清空输入
      setNewApiKey("")
      setNewApiName("")
      
      // 刷新数据
      refreshData()
      
      console.log(`✅ 添加API Key成功: ${newApiName}`)
    } else {
      console.error('❌ 添加API Key失败')
    }
  }

  const handleRemoveApiKey = (index: number) => {
    const success = apiManager.removeAPIKey('bsc', 'bscscan', index)
    if (success) {
      refreshData()
      console.log(`🗑️ 删除API Key成功`)
    } else {
      console.error('❌ 删除API Key失败')
    }
  }

  const toggleApiKeyVisibility = (index: number) => {
    setShowApiKeys(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const toggleApiKeyStatus = (index: number) => {
    const success = apiManager.toggleAPIKey('bsc', 'bscscan', index)
    if (success) {
      refreshData()
      console.log(`🔄 API Key状态切换成功`)
    } else {
      console.error('❌ API Key状态切换失败')
    }
  }



  const formatApiKey = (key: string, show: boolean, isDefault: boolean = false) => {
    if (isDefault) {
      // 默认API Key始终显示为保护状态
      return `${key.substring(0, 4)}${'*'.repeat(20)}${key.substring(key.length - 4)}`
    }
    if (show) return key
    if (key.length <= 8) return key
    return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`
  }

  const getApiKeyDisplayData = () => {
    const defaultKeys = currentApiKeys.filter(k => k.isDefault || k.protected)
    const userKeys = currentApiKeys.filter(k => !k.isDefault && !k.protected)
    
    return {
      defaultKeys,
      userKeys,
      totalActive: currentApiKeys.filter(k => k.active).length,
      hasUserKeys: userKeys.length > 0
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            多API管理器
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">状态概览</TabsTrigger>
            <TabsTrigger value="manage">管理API</TabsTrigger>
            <TabsTrigger value="strategy">轮换策略</TabsTrigger>
          </TabsList>

          {/* 状态概览 */}
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* API统计 */}
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal">当前API状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{apiStats.totalKeys}</div>
                      <div className="text-sm text-gray-600">总API数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{apiStats.activeKeys}</div>
                      <div className="text-sm text-gray-600">激活中</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{apiStats.healthyKeys}</div>
                      <div className="text-sm text-gray-600">健康状态</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{apiStats.requestsPerSecond}</div>
                      <div className="text-sm text-gray-600">请求/秒</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API来源统计 */}
              <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal">API来源分析</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <h4 className="font-semibold text-blue-700">默认提供API</h4>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {getApiKeyDisplayData().defaultKeys.length}个
                      </div>
                      <div className="text-sm text-gray-600">项目内置，始终可用</div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <h4 className="font-semibold text-green-700">用户添加API</h4>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {getApiKeyDisplayData().userKeys.length}个
                      </div>
                      <div className="text-sm text-gray-600">
                        {getApiKeyDisplayData().hasUserKeys ? "提升并发能力" : "建议添加提升速度"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-white rounded-lg border border-green-200">
                    <div className="text-sm text-gray-700">
                      <strong>当前配置：</strong>
                      默认{getApiKeyDisplayData().defaultKeys.length}个 + 用户{getApiKeyDisplayData().userKeys.length}个 = 
                      总计{apiStats.requestsPerSecond}次/秒并发能力
                      {!getApiKeyDisplayData().hasUserKeys && (
                        <span className="text-orange-600 ml-2">
                          （建议添加自己的API Key获得更高性能）
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 性能预估与优化效果 */}
              <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal">并行查询策略</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* 实际性能说明 */}
                  <div className="bg-white p-4 rounded-lg border border-green-200 mb-4">
                    <h4 className="font-semibold text-green-700 mb-2">📊 实际性能表现</h4>
                    <div className="text-sm text-gray-700 space-y-2">
                      <div>• <strong>同时查询：</strong>多个钱包同时查询</div>
                      <div>• <strong>查询速度：</strong>取决于API数量和网络状况</div>
                      <div>• <strong>并发控制：</strong>系统自动调节，避免单个API过载</div>
                      <div>• <strong>缓存优化：</strong>重复数据自动缓存，减少请求次数</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API性能说明 */}
              <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal">💡 API性能与额度说明</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-orange-700 mb-2">⚡ 性能提升效果</h4>
                      <div className="text-sm text-gray-700 space-y-1">
                        <div>• 添加1个API：速度提升33%</div>
                        <div>• 添加2个API：速度提升67%</div>
                        <div>• 添加3个API：速度提升100%</div>
                        <div className="text-orange-600 mt-2">
                          <strong>并行查询：</strong>多个API同时工作，大幅缩短等待时间
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-orange-700 mb-2">📊 免费额度（每个API）</h4>
                      <div className="text-sm text-gray-700 space-y-1">
                        <div>• 每秒5次请求</div>
                        <div>• 每天100,000次</div>
                        <div>• 完全免费使用</div>
                        <div className="text-orange-600 mt-2">
                          <strong>多API叠加：</strong>总并发能力成倍增长
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 管理API */}
          <TabsContent value="manage">
            <div className="space-y-6">
              {/* 添加新API Key */}
              <Card className="border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-600" />
                    添加API Key
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="apiName">API名称</Label>
                      <Input
                        id="apiName"
                        placeholder="例如：API Key 2"
                        value={newApiName}
                        onChange={(e) => setNewApiName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="输入BSCScan API Key"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleAddApiKey}
                        disabled={!newApiKey.trim() || !newApiName.trim()}
                        className="w-full bg-green-500 hover:bg-green-600"
                      >
                        添加
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-700">
                      <strong>获取免费API Key：</strong>
                      <ol className="mt-2 space-y-1 list-decimal list-inside">
                        <li>访问 <a href="https://bscscan.com/apis" target="_blank" className="underline">BSCScan API页面</a></li>
                        <li>注册账号并登录</li>
                        <li>创建新的API Key</li>
                        <li>复制API Key并粘贴到上方</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 默认提供的API Keys */}
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    默认提供的API Keys <span className="text-xs text-gray-500">🔒 系统默认提供，不可删除或禁用</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getApiKeyDisplayData().defaultKeys.map((apiKey, index) => {
                      const globalIndex = currentApiKeys.findIndex(k => k === apiKey)
                      return (
                        <div key={`default-${index}`} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                          <div className="flex-1">
                            <div className="font-mono text-sm text-gray-600">
                              {formatApiKey(apiKey.key, false, true)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* 用户添加的API Keys */}
              <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    你添加的API Keys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getApiKeyDisplayData().userKeys.map((apiKey, index) => {
                      const globalIndex = currentApiKeys.findIndex(k => k === apiKey)
                      return (
                        <div key={`user-${index}`} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{apiKey.name}</span>
                              <Badge variant={apiKey.active ? "default" : "secondary"}>
                                {apiKey.active ? "激活" : "禁用"}
                              </Badge>
                              <Badge variant="outline">优先级 {apiKey.priority}</Badge>
                            </div>
                            <div className="font-mono text-sm text-gray-600">
                              {formatApiKey(apiKey.key, showApiKeys[globalIndex] || false, false)}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleApiKeyVisibility(globalIndex)}
                              className="h-8 w-8 p-0"
                            >
                              {showApiKeys[globalIndex] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleApiKeyStatus(globalIndex)}
                              className="h-8 w-8 p-0"
                            >
                              {apiKey.active ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveApiKey(globalIndex)}
                              className="h-8 w-8 p-0 hover:bg-red-100 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {getApiKeyDisplayData().userKeys.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="mb-2">你还没有添加自己的API Key</div>
                      <div className="text-sm text-orange-600">
                        💡 添加你的API Key可以显著提升查询速度！
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 轮换策略 */}
          <TabsContent value="strategy">
            <div className="space-y-6">
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal">API轮换策略</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-700 mb-2">🔄 请求级轮换（当前使用）</h4>
                      <div className="text-sm text-gray-700 space-y-2">
                        <div>• <strong>策略：</strong>每个API请求都使用下一个可用的API Key</div>
                        <div>• <strong>优点：</strong>负载最均衡，充分利用所有API并发能力</div>
                        <div>• <strong>适用：</strong>多钱包批量查询</div>
                        <div>• <strong>效果：</strong>5个API Key → 25次/秒并发能力</div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-2">📦 钱包级轮换</h4>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div>• <strong>策略：</strong>一个钱包的所有请求用同一个API Key</div>
                        <div>• <strong>优点：</strong>实现简单，便于追踪</div>
                        <div>• <strong>缺点：</strong>负载不均衡，单个API易达到限制</div>
                        <div>• <strong>适用：</strong>少量钱包查询</div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-2">⏰ 时间窗口轮换</h4>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div>• <strong>策略：</strong>每个时间段（如1分钟）切换API Key</div>
                        <div>• <strong>优点：</strong>避免频繁切换，适合持续查询</div>
                        <div>• <strong>缺点：</strong>短时间内并发能力受限</div>
                        <div>• <strong>适用：</strong>定时任务或监控</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* 健康检查和故障转移 */}
              <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-normal">智能健康检查</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-orange-700 mb-2">📊 健康监控</h4>
                      <div className="text-sm space-y-1">
                        <div>• 响应时间监控</div>
                        <div>• 错误率统计</div>
                        <div>• 连续失败检测</div>
                        <div>• 自动恢复检查</div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-orange-700 mb-2">🔄 故障转移</h4>
                      <div className="text-sm space-y-1">
                        <div>• 自动跳过不健康API</div>
                        <div>• 3次重试机制</div>
                        <div>• 渐进式延迟重试</div>
                        <div>• 备用API保护</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}