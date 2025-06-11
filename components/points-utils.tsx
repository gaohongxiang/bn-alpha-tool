"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// 积分计算工具函数
export const PointsUtils = {
  // 计算余额积分
  balance: (balanceAmount: number): number => {
    if (balanceAmount >= 100000) return 4
    if (balanceAmount >= 10000) return 3
    if (balanceAmount >= 1000) return 2
    if (balanceAmount >= 100) return 1
    return 0
  },
  
  // 计算交易量积分
  tradingVolume: (volume: number): number => {
    if (volume < 2) return 0
    // 从$2开始，每翻倍增加1分
    let points = 1
    let threshold = 4
    while (volume >= threshold) {
      points++
      threshold *= 2
    }
    return points
  },
  
  // BSC链专用：计算翻倍后的交易量积分
  bscTradingVolume: (actualVolume: number): number => {
    const doubledVolume = actualVolume * 2
    return PointsUtils.tradingVolume(doubledVolume)
  },
  
  // 获取余额积分说明
  getBalancePointsDescription: (balanceAmount: number): string => {
    if (balanceAmount >= 100000) return "$100,000以上 → 4积分"
    if (balanceAmount >= 10000) return "$10,000 - $99,999 → 3积分"
    if (balanceAmount >= 1000) return "$1,000 - $9,999 → 2积分"
    if (balanceAmount >= 100) return "$100 - $999 → 1积分"
    return "低于$100 → 0积分"
  },
  
  // 获取交易量积分说明
  getTradingVolumePointsDescription: (volume: number): string => {
    if (volume < 2) return "低于$2 → 0积分"
    
    let threshold = 2
    let points = 1
    
    while (volume >= threshold * 2 && points < 20) { // 限制最大积分避免无限循环
      threshold *= 2
      points++
    }
    
    const nextThreshold = threshold * 2
    return `$${threshold} - $${nextThreshold - 0.01} → ${points}积分`
  }
}

// 余额积分显示组件
interface BalancePointsProps {
  balance: number
  showDescription?: boolean
  className?: string
}

export function BalancePoints({ balance, showDescription = false, className = "" }: BalancePointsProps) {
  const points = PointsUtils.balance(balance)
  const description = PointsUtils.getBalancePointsDescription(balance)
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={points > 0 ? "default" : "secondary"} className="font-normal">
        {points}分
      </Badge>
      {showDescription && (
        <span className="text-xs text-gray-500">{description}</span>
      )}
    </div>
  )
}

// 交易量积分显示组件
interface TradingVolumePointsProps {
  volume: number
  isBSC?: boolean
  showDescription?: boolean
  className?: string
}

export function TradingVolumePoints({ 
  volume, 
  isBSC = false, 
  showDescription = false, 
  className = "" 
}: TradingVolumePointsProps) {
  const points = isBSC ? PointsUtils.bscTradingVolume(volume) : PointsUtils.tradingVolume(volume)
  const calculationVolume = isBSC ? volume * 2 : volume
  const description = PointsUtils.getTradingVolumePointsDescription(calculationVolume)
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={points > 0 ? "default" : "secondary"} className="font-normal">
        {points}分
      </Badge>
      {isBSC && (
        <span className="text-xs text-orange-600">BSC翻倍</span>
      )}
      {showDescription && (
        <span className="text-xs text-gray-500">{description}</span>
      )}
    </div>
  )
}

// 积分规则说明卡片
export function PointsRulesCard() {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-normal text-blue-900">积分计算规则</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-blue-800 mb-2">余额积分</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white px-3 py-2 rounded border">$100 - $999 → 1积分</div>
            <div className="bg-white px-3 py-2 rounded border">$1,000 - $9,999 → 2积分</div>
            <div className="bg-white px-3 py-2 rounded border">$10,000 - $99,999 → 3积分</div>
            <div className="bg-white px-3 py-2 rounded border">$100,000以上 → 4积分</div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium text-blue-800 mb-2">交易量积分</h4>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-white px-3 py-2 rounded border">$2 → 1积分</div>
            <div className="bg-white px-3 py-2 rounded border">$4 → 2积分</div>
            <div className="bg-white px-3 py-2 rounded border">$8 → 3积分</div>
            <div className="bg-white px-3 py-2 rounded border">$16 → 4积分</div>
            <div className="bg-white px-3 py-2 rounded border">$32 → 5积分</div>
            <div className="bg-white px-3 py-2 rounded border">$64 → 6积分</div>
            <div className="bg-white px-3 py-2 rounded border">$128 → 7积分</div>
            <div className="bg-white px-3 py-2 rounded border">$256 → 8积分</div>
            <div className="bg-white px-3 py-2 rounded border">$512 → 9积分</div>
          </div>
          <p className="text-xs text-blue-700 mt-2">
            <strong>特别说明：</strong>BSC链交易量翻倍计算积分
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 