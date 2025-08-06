"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { AirdropForm } from '@/components/admin/airdrop-form'
import { AirdropTable } from '@/components/admin/airdrop-table'
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog'
import type { AirdropItem } from '@/types/airdrop'

export default function AdminPage() {
  const { toast } = useToast()
  const [airdrops, setAirdrops] = useState<AirdropItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  
  // 表单状态
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<AirdropItem | null>(null)
  
  // 删除确认状态
  const [deleteItem, setDeleteItem] = useState<AirdropItem | null>(null)

  // 验证管理员权限
  const verifyAdmin = async (key: string) => {
    try {
      const response = await fetch('/api/admin/airdrop', {
        headers: {
          'x-admin-key': key
        }
      })
      
      if (response.ok) {
        setIsAuthenticated(true)
        localStorage.setItem('admin-key', key)
        loadAirdrops(key)
      } else {
        setError('管理员密钥错误')
      }
    } catch (err) {
      setError('验证失败，请检查网络连接')
    }
  }

  // 加载空投数据
  const loadAirdrops = async (key?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const adminKeyToUse = key || localStorage.getItem('admin-key') || adminKey
      
      const response = await fetch('/api/admin/airdrop', {
        headers: {
          'x-admin-key': adminKeyToUse
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        setAirdrops(result.data || [])
        setIsAuthenticated(true)
      } else if (response.status === 403) {
        setIsAuthenticated(false)
        localStorage.removeItem('admin-key')
        setError('权限验证失败，请重新登录')
      } else {
        setError('加载数据失败')
      }
    } catch (err) {
      setError('网络错误，无法加载数据')
    } finally {
      setLoading(false)
    }
  }

  // 静默刷新数据（不显示加载状态）
  const refreshAirdrops = async () => {
    try {
      const adminKeyToUse = localStorage.getItem('admin-key') || adminKey
      
      const response = await fetch('/api/admin/airdrop', {
        headers: {
          'x-admin-key': adminKeyToUse
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        setAirdrops(result.data || [])
      }
    } catch (err) {
      // 静默失败，不显示错误
      console.error('刷新数据失败:', err)
    }
  }

  // 处理表单提交
  const handleFormSubmit = async (data: Partial<AirdropItem>) => {
    try {
      const adminKeyToUse = localStorage.getItem('admin-key') || adminKey
      const isEditing = !!editingItem
      
      const response = await fetch('/api/admin/airdrop', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKeyToUse
        },
        body: JSON.stringify(isEditing ? { ...data, id: editingItem.id } : data)
      })
      
      const result = await response.json()
      
      if (result.success) {
        // 显示绿色成功提示
        toast({
          title: isEditing ? "更新成功" : "创建成功",
          description: `空投数据 "${data.token}" ${isEditing ? '更新' : '创建'}成功`,
          className: "bg-green-50 border-green-200 text-green-800",
        })
        
        setShowForm(false)
        setEditingItem(null)
        refreshAirdrops() // 静默刷新数据，不显示加载状态
      } else {
        // 显示错误消息
        toast({
          variant: "destructive",
          title: "操作失败",
          description: result.error || '操作失败，请重试',
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "网络错误",
        description: '网络错误，操作失败',
      })
    }
  }

  // 处理删除
  const handleDelete = async (item: AirdropItem) => {
    try {
      const adminKeyToUse = localStorage.getItem('admin-key') || adminKey
      
      const response = await fetch(`/api/admin/airdrop?id=${item.id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminKeyToUse
        }
      })
      
      const result = await response.json()
      
      if (result.success) {
        // 显示绿色成功提示
        toast({
          title: "删除成功",
          description: `空投数据 "${item.token}" 删除成功`,
          className: "bg-green-50 border-green-200 text-green-800",
        })
        
        setDeleteItem(null)
        refreshAirdrops() // 静默刷新数据，不显示加载状态
      } else {
        // 显示错误消息
        toast({
          variant: "destructive",
          title: "删除失败",
          description: result.error || '删除失败，请重试',
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "网络错误",
        description: '网络错误，删除失败',
      })
    }
  }

  // 初始化检查
  useEffect(() => {
    const savedKey = localStorage.getItem('admin-key')
    if (savedKey) {
      setAdminKey(savedKey)
      loadAirdrops(savedKey)
    } else {
      setLoading(false)
    }
  }, [])

  // 登录界面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">管理员登录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">管理员密钥</label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="请输入管理员密钥"
                  onKeyDown={(e) => e.key === 'Enter' && verifyAdmin(adminKey)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
            
            <Button 
              onClick={() => verifyAdmin(adminKey)} 
              className="w-full"
              disabled={!adminKey.trim()}
            >
              登录
            </Button>
            
            <div className="text-xs text-gray-500 text-center">
              管理员密钥在环境变量 ADMIN_KEY 中设置
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 主管理界面
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  🛠️ 空投数据管理
                  <Badge variant="secondary">管理员</Badge>
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  管理空投数据，支持增删改查操作
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAirdrops()}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
                <Button
                  onClick={() => {
                    setEditingItem(null)
                    setShowForm(true)
                  }}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新增空投
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 数据统计 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{airdrops.length}</div>
              <div className="text-sm text-gray-600">总空投数量</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {airdrops.filter(item => item.startTime).length}
              </div>
              <div className="text-sm text-gray-600">当前空投</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">
                {airdrops.filter(item => !item.startTime).length}
              </div>
              <div className="text-sm text-gray-600">历史空投</div>
            </CardContent>
          </Card>
        </div>

        {/* 数据表格 */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <div>加载中...</div>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">
                <div className="mb-2">❌ {error}</div>
                <Button variant="outline" onClick={() => loadAirdrops()}>
                  重试
                </Button>
              </div>
            ) : (
              <AirdropTable
                data={airdrops}
                onEdit={(item) => {
                  setEditingItem(item)
                  setShowForm(true)
                }}
                onDelete={(item) => setDeleteItem(item)}
              />
            )}
          </CardContent>
        </Card>

        {/* 表单弹窗 */}
        {showForm && (
          <AirdropForm
            item={editingItem}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setShowForm(false)
              setEditingItem(null)
            }}
          />
        )}

        {/* 删除确认弹窗 */}
        {deleteItem && (
          <DeleteConfirmDialog
            item={deleteItem}
            onConfirm={() => handleDelete(deleteItem)}
            onCancel={() => setDeleteItem(null)}
          />
        )}
      </div>
    </div>
  )
}
