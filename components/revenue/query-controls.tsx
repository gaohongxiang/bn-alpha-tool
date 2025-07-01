"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Search, RefreshCw, Settings, AlertCircle, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface QueryControlsProps {
  selectedDate: string
  onDateChange: (date: string) => void
  onQuery: () => void
  onApiConfig?: () => void
  onShowRules?: () => void
  isQuerying: boolean
  walletsCount: number
  hasQueried: boolean
  bnbPrice?: number
  isLoadingPrice?: boolean
}

export function QueryControls({
  selectedDate,
  onDateChange,
  onQuery,
  onApiConfig,
  onShowRules,
  isQuerying,
  walletsCount,
  hasQueried,
  bnbPrice = 600,
  isLoadingPrice = false
}: QueryControlsProps) {
  // 获取日期选择的快捷选项
  const getQuickDates = () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0]
    }
    
    return [
      { label: "今天", value: formatDate(today) },
      { label: "昨天", value: formatDate(yesterday) },
    ]
  }

  const quickDates = getQuickDates()

  return (
    <div className="space-y-4">
      {/* 主查询控制卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            查询控制
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 日期选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">选择查询日期</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="flex-1"
                disabled={isQuerying}
              />
              <Select value={selectedDate} onValueChange={onDateChange} disabled={isQuerying}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="快选" />
                </SelectTrigger>
                <SelectContent>
                  {quickDates.map((date) => (
                    <SelectItem key={date.value} value={date.value}>
                      {date.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500">
              💡 查询该日期的钱包余额和交易数据（北京时间8:00-次日7:59）
            </p>
          </div>

          {/* 查询状态 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={walletsCount > 0 ? "default" : "secondary"}>
              {walletsCount} 个钱包
            </Badge>
            {hasQueried && (
              <Badge variant="outline">
                已查询
              </Badge>
            )}
            {/* BNB价格显示 */}
            <Badge variant="outline" className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              BNB: {isLoadingPrice ? "..." : `$${bnbPrice.toFixed(0)}`}
            </Badge>
          </div>

          {/* 操作按钮 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button
              onClick={onQuery}
              disabled={isQuerying || walletsCount === 0}
              className="bg-green-500 hover:bg-green-600"
            >
              {isQuerying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  查询中...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  批量查询
                </>
              )}
            </Button>
            


            {onApiConfig && (
              <Button
                variant="outline"
                onClick={onApiConfig}
                disabled={isQuerying}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                API管理
              </Button>
            )}
          </div>

          {/* 查询说明 */}
          {walletsCount === 0 && (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                ⚠️ 请先添加钱包地址再进行查询
              </p>
            </div>
          )}

          {isQuerying && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                🔄 正在查询 {walletsCount} 个钱包的数据，请稍候...
              </p>
              <p className="text-xs text-blue-600 mt-1">
                大约需要 {Math.ceil(walletsCount * 2)} 秒完成
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 规则说明卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            查询优化 & 规则说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 查询优化提示 */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">🚀 查询优化</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• 智能并发：最多3个请求同时进行</li>
              <li>• API轮换：自动切换API Key避免限制</li>
              <li>• 缓存机制：5分钟内重复查询使用缓存</li>
              <li>• 错误重试：失败请求自动重试</li>
            </ul>
          </div>

          {/* 规则说明按钮 */}
          {onShowRules && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowRules}
              className="w-full text-left justify-start text-blue-600 hover:bg-blue-50"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              查看详细交易统计规则
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 