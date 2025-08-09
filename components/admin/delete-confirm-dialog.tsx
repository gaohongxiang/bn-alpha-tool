"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, X, CheckCircle, Trash2, Loader2 } from 'lucide-react'
import type { AirdropItem } from '@/types/airdrop'

interface DeleteConfirmDialogProps {
  item: AirdropItem
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}

export function DeleteConfirmDialog({ item, onConfirm, onCancel, isDeleting = false }: DeleteConfirmDialogProps) {
  // 格式化积分显示
  const formatPoints = (item: AirdropItem) => {
    if (item.phase1Points && item.phase2Points) {
      return `${item.phase1Points}/${item.phase2Points} 分`
    }
    return `${item.points || 0} 分`
  }

  // 获取状态标签
  const getStatusBadge = (item: AirdropItem) => {
    if (item.startTime) {
      return <Badge variant="default" className="bg-green-500 text-white">当前空投</Badge>
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-700">历史空投</Badge>
  }

  // 获取类型标签
  const getTypeBadge = (type: string) => {
    return (
      <Badge variant={type === 'alpha' ? 'default' : 'outline'}
        className={type === 'alpha' ? 'bg-green-600 text-white' : 'border-green-300 text-green-700'}>
        {type.toUpperCase()}
      </Badge>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md border-green-200 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Trash2 className="h-5 w-5" />
              确认删除
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onCancel} className="hover:bg-green-100">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 bg-green-50/30">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-green-800 font-medium">
                您确定要删除以下空投数据吗？
              </p>
            </div>
            <p className="text-green-700 text-sm">
              此操作不可撤销，删除后数据将永久丢失。
            </p>
          </div>

          {/* 空投信息预览 */}
          <div className="bg-white border border-green-100 rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{item.token}</span>
              {getStatusBadge(item)}
              {getTypeBadge(item.type)}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">日期:</span>
                <div className="font-medium">{item.date}</div>
              </div>
              <div>
                <span className="text-gray-500">积分门槛:</span>
                <div className="font-medium">{formatPoints(item)}</div>
              </div>
              <div>
                <span className="text-gray-500">空投数量:</span>
                <div className="font-medium">{item.amount}</div>
              </div>
              <div>
                <span className="text-gray-500">补充代币:</span>
                <div className="font-medium">{item.supplementaryToken}</div>
              </div>
              {item.currentPrice && (
                <div>
                  <span className="text-gray-500">当前价格:</span>
                  <div className="font-medium">{item.currentPrice}</div>
                </div>
              )}
              {item.participants && (
                <div>
                  <span className="text-gray-500">参与人数:</span>
                  <div className="font-medium">{item.participants}</div>
                </div>
              )}
            </div>

            {item.startTime && (
              <div className="border-t pt-3">
                <span className="text-gray-500 text-sm">时间安排:</span>
                <div className="text-sm mt-1">
                  <div>开始: {item.startTime}</div>
                  {item.endTime && <div>结束: {item.endTime}</div>}
                  {item.phase1EndTime && <div>阶段1结束: {item.phase1EndTime}</div>}
                  {item.phase2EndTime && <div>阶段2结束: {item.phase2EndTime}</div>}
                </div>
              </div>
            )}

            {item.description && (
              <div className="border-t pt-3">
                <span className="text-gray-500 text-sm">描述:</span>
                <div className="text-sm mt-1">{item.description}</div>
              </div>
            )}
          </div>

          {/* 特殊提醒 */}
          {item.startTime && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">注意：这是一个当前空投</span>
              </div>
              <p className="text-amber-700 text-sm mt-1">
                删除后将不再显示在空投提醒中，用户将无法看到此空投信息。
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-green-100">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isDeleting}
              className="border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  确认删除
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
