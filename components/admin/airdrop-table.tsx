"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Edit, Trash2, Search, Filter, Clock, Calendar } from 'lucide-react'
import type { AirdropItem } from '@/types/airdrop'
import { TypeBadge } from '@/components/ui/type-badge'

interface AirdropTableProps {
  data: AirdropItem[]
  onEdit: (item: AirdropItem) => void
  onDelete: (item: AirdropItem) => void
}

export function AirdropTable({ data, onEdit, onDelete }: AirdropTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // 过滤和排序数据
  const filteredData = data
    .filter(item => {
      const matchesSearch = !searchTerm || 
        item.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.date.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = typeFilter === 'all' || item.type === typeFilter
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'current' && item.startTime) ||
        (statusFilter === 'history' && !item.startTime)
      
      return matchesSearch && matchesType && matchesStatus
    })
    .sort((a, b) => {
      // 1. 当前空投永远在历史空投前面
      const aIsCurrent = !!a.startTime
      const bIsCurrent = !!b.startTime
      
      if (aIsCurrent && !bIsCurrent) return -1  // a是当前，b是历史 -> a在前
      if (!aIsCurrent && bIsCurrent) return 1   // a是历史，b是当前 -> b在前
      
      // 2. 同类型内按日期排序：最新的在前面
      const parseDate = (dateStr: string) => {
        // 支持多种日期格式
        if (dateStr.includes('年')) {
          // 格式：2025年08月09日
          const match = dateStr.match(/(\d{4})年(\d{2})月(\d{2})日/)
          if (match) {
            const [, year, month, day] = match
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          }
        }
        // 格式：2025-08-09
        return new Date(dateStr)
      }

      const dateA = parseDate(a.date)
      const dateB = parseDate(b.date)
      
      // 降序排序：最新的在前面
      return dateB.getTime() - dateA.getTime()
    })

  // 格式化价格显示
  const formatPrice = (price: string | null) => {
    if (!price) return '-'
    return price
  }

  // 格式化积分显示
  const formatPoints = (item: AirdropItem) => {
    if (item.phase1Points && item.phase2Points) {
      return `${item.phase1Points}/${item.phase2Points}`
    }
    return item.points?.toString() || '-'
  }

  // 格式化时间显示
  const formatTime = (item: AirdropItem) => {
    if (!item.startTime) return '-'
    
    if (item.phase1EndTime && item.phase2EndTime) {
      return (
        <div className="text-xs">
          <div>开始: {item.startTime}</div>
          <div>阶段1: {item.phase1EndTime}</div>
          <div>阶段2: {item.phase2EndTime}</div>
        </div>
      )
    }
    
    if (item.endTime) {
      return (
        <div className="text-xs">
          <div>开始: {item.startTime}</div>
          <div>结束: {item.endTime}</div>
        </div>
      )
    }
    
    return item.startTime
  }

  // 获取状态标签
  const getStatusBadge = (item: AirdropItem) => {
    if (item.startTime) {
      return <Badge variant="default" className="bg-green-500">当前</Badge>
    }
    return <Badge variant="secondary">历史</Badge>
  }

  // 获取类型标签
  const getTypeBadge = (type: string) => {
    return <TypeBadge type={type} />
  }

  return (
    <div className="space-y-4">
      {/* 搜索和过滤 */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索代币名称或日期..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="airdrop">airdrop</SelectItem>
            <SelectItem value="tge">tge</SelectItem>
            <SelectItem value="preTge">preTge</SelectItem>
            <SelectItem value="bondingCurveTge">bondingCurveTge</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="current">当前空投</SelectItem>
            <SelectItem value="history">历史空投</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 数据统计 */}
      <div className="flex items-center justify-between text-sm text-gray-600 px-4">
        <div>
          显示 {filteredData.length} / {data.length} 条记录
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>当前空投 ({data.filter(item => item.startTime).length})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span>历史空投 ({data.filter(item => !item.startTime).length})</span>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium">状态</th>
              <th className="text-left p-3 font-medium">代币</th>
              <th className="text-left p-3 font-medium">日期</th>
              <th className="text-left p-3 font-medium">类型</th>
              <th className="text-left p-3 font-medium">积分</th>
              <th className="text-left p-3 font-medium">数量</th>
              <th className="text-left p-3 font-medium">价格</th>
              <th className="text-left p-3 font-medium">时间安排</th>
              <th className="text-left p-3 font-medium">参与人数</th>
              <th className="text-left p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center p-8 text-gray-500">
                  {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' 
                    ? '没有找到匹配的记录' 
                    : '暂无数据'
                  }
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    {getStatusBadge(item)}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{item.token}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-1 max-w-32 truncate" title={item.description}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm">{item.date}</td>
                  <td className="p-3">
                    {getTypeBadge(item.type)}
                  </td>
                  <td className="p-3">
                    <div className="text-sm font-medium">{formatPoints(item)}</div>
                    {!item.pointsConsumed && (
                      <div className="text-xs text-orange-600">不消耗</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="text-sm">
                      <div>主: {item.amount}</div>
                      <div className="text-gray-500">补: {item.supplementaryToken}</div>
                    </div>
                  </td>
                  <td className="p-3 text-sm">
                    {formatPrice(item.currentPrice)}
                    {item.cost && (
                      <div className="text-xs text-red-600">成本: {item.cost}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="max-w-40">
                      {formatTime(item)}
                    </div>
                  </td>
                  <td className="p-3 text-sm">
                    {item.participants || '-'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片视图 */}
      <div className="md:hidden space-y-3">
        {filteredData.map((item) => (
          <div key={item.id} className="bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.token}</span>
                {getStatusBadge(item)}
                {getTypeBadge(item.type)}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(item)}
                  className="h-8 w-8 p-0 text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">日期:</span> {item.date}
              </div>
              <div>
                <span className="text-gray-500">积分:</span> {formatPoints(item)}
              </div>
              <div>
                <span className="text-gray-500">数量:</span> {item.amount} + {item.supplementaryToken}
              </div>
              <div>
                <span className="text-gray-500">价格:</span> {formatPrice(item.currentPrice)}
              </div>
              {item.participants && (
                <div>
                  <span className="text-gray-500">参与:</span> {item.participants}
                </div>
              )}
              {item.cost && (
                <div>
                  <span className="text-gray-500">成本:</span> {item.cost}
                </div>
              )}
            </div>
            
            {item.startTime && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                {formatTime(item)}
              </div>
            )}
            
            {item.description && (
              <div className="text-xs text-gray-600 border-t pt-2">
                {item.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
