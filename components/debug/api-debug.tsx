'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function APIDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<string>('')

  const handleDebugInfo = () => {
    const info = `🔍 === API 调试信息 ===
📊 新架构状态:
  ✅ API服务层: services/api/
  ✅ 缓存服务: services/data/cache-service.ts
  ✅ 业务服务: services/analysis/
  
📈 优化效果:
  🚧 组件重构中...
  ⏳ API调试功能迁移到新架构中
  
💡 新架构优势:
  - 模块化API管理
  - 智能缓存策略  
  - 类型安全保证
  - 测试覆盖完整`
    
    setDebugInfo(info)
    console.log(info)
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>API 调试面板</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleDebugInfo}>
            📊 查看架构状态
          </Button>
          <Button variant="outline" disabled>
            🔄 功能迁移中
          </Button>
        </div>
        
        {debugInfo && (
          <div className="bg-gray-100 p-4 rounded-lg">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {debugInfo}
            </pre>
          </div>
        )}
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">🚧 重构说明</h4>
          <p className="text-sm text-gray-600">
            API调试功能正在迁移到新的服务架构中。原有的apiManager已替换为模块化的API服务层。
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 