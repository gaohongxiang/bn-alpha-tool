"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Plus, Trash2, Power, PowerOff, RefreshCw } from "lucide-react"
import { configManager } from "@/lib/config-manager"

interface APIConfigPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function APIConfigPanel({ open, onOpenChange }: APIConfigPanelProps) {
  const [newApiKey, setNewApiKey] = useState("")
  const [newApiName, setNewApiName] = useState("")
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({})
  const [isLoading, setIsLoading] = useState(false)
  
  const [apiStats, setApiStats] = useState({
    totalKeys: 0,
    activeKeys: 0,
    currentNetwork: 'bsc'
  })

  const [currentApiKeys, setCurrentApiKeys] = useState<Array<{
    key: string
    name: string
    active: boolean
  }>>([])

  // 刷新数据的函数
  const refreshData = async () => {
    try {
      setIsLoading(true)
      
      // 确保ConfigManager已初始化
      await configManager.initialize()
      
      // 获取API配置
      const apiConfig = configManager.getAPIConfig()
      if (apiConfig?.keys) {
        setCurrentApiKeys([...apiConfig.keys])
        
        const activeKeys = apiConfig.keys.filter(k => k.active).length
        setApiStats({
          totalKeys: apiConfig.keys.length,
          activeKeys: activeKeys,
          currentNetwork: configManager.getCurrentNetwork()
        })
        
        console.log('🔍 API配置面板刷新数据:', {
          totalKeys: apiConfig.keys.length,
          activeKeys: activeKeys,
          keys: apiConfig.keys.map(k => ({ name: k.name, active: k.active }))
        })
      } else {
        console.log('❌ 未找到BSCScan配置')
        setCurrentApiKeys([])
        setApiStats({ totalKeys: 0, activeKeys: 0, currentNetwork: 'bsc' })
      }
    } catch (error) {
      console.error('❌ 刷新API配置失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      refreshData()
    }
  }, [open])

  const handleAddApiKey = async () => {
    if (!newApiKey.trim() || !newApiName.trim()) {
      console.log('❌ API Key和名称不能为空')
      return
    }

    try {
      const success = configManager.addUserAPIKey({
        key: newApiKey.trim(),
        name: newApiName.trim(),
        active: true
      })
      
      if (success) {
        // 清空输入
        setNewApiKey("")
        setNewApiName("")
        
        // 刷新数据
        await refreshData()
        
        console.log(`✅ 添加API Key成功: ${newApiName}`)
      } else {
        console.error('❌ 添加API Key失败')
      }
    } catch (error) {
      console.error('❌ 添加API Key异常:', error)
    }
  }

  const handleRemoveApiKey = async (index: number) => {
    try {
      const keyToRemove = currentApiKeys[index]
      if (!keyToRemove) return

      const success = await configManager.removeUserAPIKey(keyToRemove.key)
      
      if (success) {
        await refreshData()
        console.log(`✅ 删除API Key成功: ${keyToRemove.name}`)
      } else {
        console.error('❌ 删除API Key失败')
      }
    } catch (error) {
      console.error('❌ 删除API Key异常:', error)
    }
  }

  const handleToggleApiKey = async (index: number) => {
    try {
      const keyToToggle = currentApiKeys[index]
      if (!keyToToggle) return

      const success = await configManager.toggleUserAPIKey(keyToToggle.key)
      
      if (success) {
        await refreshData()
        console.log(`✅ 切换API Key状态成功: ${keyToToggle.name}`)
      } else {
        console.error('❌ 切换API Key状态失败')
      }
    } catch (error) {
      console.error('❌ 切换API Key状态异常:', error)
    }
  }

  const toggleShowApiKey = (index: number) => {
    setShowApiKeys(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const maskApiKey = (apiKey: string) => {
    if (apiKey.length <= 8) return apiKey
    return `${apiKey.substring(0, 6)}${'*'.repeat(apiKey.length - 10)}${apiKey.substring(apiKey.length - 4)}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            🔑 BSCScan API 配置管理
          </DialogTitle>
          <p className="text-gray-600 mt-2">管理BSCScan API密钥，提高查询速度和并发能力</p>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* API状态概览 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
            <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-3">
              📊 API状态概览
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshData}
                disabled={isLoading}
                className="ml-auto"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </h3>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{apiStats.totalKeys}</div>
                <div className="text-sm text-gray-600">总API Key数量</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                <div className="text-2xl font-bold text-green-600">{apiStats.activeKeys}</div>
                <div className="text-sm text-gray-600">活跃API Key</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                <div className="text-2xl font-bold text-purple-600">{apiStats.activeKeys * 5}/秒</div>
                <div className="text-sm text-gray-600">理论最大RPS</div>
              </div>
            </div>
          </div>

          {/* 添加新API Key */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                添加新的API Key
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="apiName">API Key名称</Label>
                <Input
                  id="apiName"
                  placeholder="例如：我的API Key 1"
                  value={newApiName}
                  onChange={(e) => setNewApiName(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  placeholder="输入BSCScan API Key"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  type="password"
                />
              </div>
              
              <Button 
                onClick={handleAddApiKey}
                disabled={!newApiKey.trim() || !newApiName.trim() || isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加API Key
              </Button>
            </CardContent>
          </Card>

          {/* 现有API Key列表 */}
          <Card>
            <CardHeader>
              <CardTitle>现有API Key ({currentApiKeys.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {currentApiKeys.length > 0 ? (
                <div className="space-y-3">
                  {currentApiKeys.map((apiKey, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          {apiKey.active ? (
                            <Power className="w-4 h-4 text-green-500" />
                          ) : (
                            <PowerOff className="w-4 h-4 text-gray-400" />
                          )}
                          
                          <Badge variant={apiKey.active ? "default" : "secondary"}>
                            {apiKey.active ? "活跃" : "禁用"}
                          </Badge>
                        </div>
                        
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{apiKey.name}</div>
                          <div className="font-mono text-sm text-gray-600">
                            {showApiKeys[index] ? apiKey.key : maskApiKey(apiKey.key)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleShowApiKey(index)}
                        >
                          {showApiKeys[index] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleApiKey(index)}
                          disabled={isLoading}
                        >
                          {apiKey.active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveApiKey(index)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无API Key，请添加至少一个API Key以开始使用
                </div>
              )}
            </CardContent>
          </Card>

          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>📖 使用说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">🔑 获取API Key</h4>
                  <div className="space-y-1 text-gray-600">
                    <div>1. 访问 <a href="https://bscscan.com/apis" target="_blank" className="text-blue-600 underline">BSCScan API</a></div>
                    <div>2. 注册并创建免费API Key</div>
                    <div>3. 复制API Key并添加到此处</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">⚡ 性能提升</h4>
                  <div className="space-y-1 text-gray-600">
                    <div>• 多个API Key可并行请求</div>
                    <div>• 免费版：每个Key每秒5次请求</div>
                    <div>• 推荐添加3-5个Key以获得最佳性能</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-6 border-t">
          <Button onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}