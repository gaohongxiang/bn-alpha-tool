"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, TrendingUp, Award, BarChart3 } from "lucide-react"
import airdropAllData from "@/data/airdrop-history.json"

// 定义统一的空投数据类型
interface AirdropItem {
  date: string
  token: string
  points: number
  participants: number | null
  amount: number | string  // 支持字符串和数字类型
  supplementaryToken: number | string  // 支持字符串和数字类型 | string
  currentPrice: string | null
  type: "alpha" | "tge"
  cost?: number  // TGE项目的成本（可选）
  pointsConsumed?: boolean  // 可选字段，默认为true
  // 两阶段时间字段（可选，有则为当前空投）
  startTime?: string // 格式: "2025-06-19 20:00 (UTC+8)"
  // 简化的两阶段字段
  phase1Points?: number
  phase2Points?: number
  phase1EndTime?: string
  phase2EndTime?: string
  // 兼容旧格式的结束时间
  endTime?: string   // 格式: "2025-06-12 10:00 (UTC+8)"
  description?: string
}

// 历史数据类型（带计算字段）
interface AirdropHistoryItem extends AirdropItem {
  currentValue: string
  revenue: number
}

// 当前空投数据类型
interface CurrentAirdropItem extends AirdropItem {
  startTime: string // 必需字段
  phase1Points?: number
  phase2Points?: number
  phase1EndTime?: string
  phase2EndTime?: string
  endTime?: string   // 兼容旧格式
}

// 计算总价值的辅助函数
function calculateCurrentValue(amount: number | string, supplementaryToken: number | string, currentPrice: string): string {
  const price = parseFloat(currentPrice.replace('$', ''))
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount
  const supplementaryTokenNum = typeof supplementaryToken === 'string' ? parseFloat(supplementaryToken) : supplementaryToken
  const totalAmount = amountNum + supplementaryTokenNum
  const totalValue = totalAmount * price
  return `$${totalValue.toFixed(2)}`
}

// 计算单号收益的辅助函数
function calculateRevenue(amount: number | string, supplementaryToken: number | string, currentPrice: string, cost?: number): number {
  const price = parseFloat(currentPrice.replace('$', ''))
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount
  const supplementaryTokenNum = typeof supplementaryToken === 'string' ? parseFloat(supplementaryToken) : supplementaryToken
  const totalAmount = amountNum + supplementaryTokenNum
  const totalValue = totalAmount * price
  const netRevenue = totalValue - (cost || 0)
  return parseFloat(netRevenue.toFixed(2))
}

export function AirdropHistory() {
  const [activeView, setActiveView] = useState("chart") // 默认显示历史曲线
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number
    y: number
    data: any
    index: number
  } | null>(null)
  
  // 实时倒计时状态
  const [countdowns, setCountdowns] = useState<{[key: string]: any}>({})

  // 从合并的数据中分离当前空投和历史数据
  const allData = airdropAllData as AirdropItem[]
  const currentAirdrops: CurrentAirdropItem[] = allData.filter(item => 
    item.startTime && (item.phase1EndTime || item.endTime)
  ) as CurrentAirdropItem[]
  const historyRawData: AirdropItem[] = allData.filter(item => 
    !item.startTime || (!item.phase1EndTime && !item.endTime)
  )

  // 将UTC+8时间字符串转换为Date对象
  const parseUTC8Time = (timeStr: string): Date => {
    // 从 "2025-06-11 10:00 (UTC+8)" 中提取日期时间部分
    const match = timeStr.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
    if (!match) return new Date()
    
    const [, dateStr, timeStr2] = match
    // 创建UTC+8时间并转换为UTC
    const utc8Date = new Date(`${dateStr}T${timeStr2}:00+08:00`)
    return utc8Date
  }

  // 获取当前空投的状态信息
  const getAirdropStatus = (airdrop: CurrentAirdropItem) => {
    const now = new Date()
    const start = parseUTC8Time(airdrop.startTime)
    
    // 如果有两阶段配置，使用两阶段逻辑
    if (airdrop.phase1EndTime && airdrop.phase2EndTime) {
      const phase1End = parseUTC8Time(airdrop.phase1EndTime)
      const phase2End = parseUTC8Time(airdrop.phase2EndTime)
      
      if (now < start) {
        return { 
          status: "未开始", 
          color: "gray", 
          progress: 0,
          phase: "waiting",
          currentPhase: null,
          points: airdrop.phase1Points || 0
        }
      } else if (now >= start && now < phase1End) {
        // 第一阶段：优先获取
        const total = phase1End.getTime() - start.getTime()
        const elapsed = now.getTime() - start.getTime()
        const progress = Math.max(0, Math.min(100, (elapsed / total) * 100))
        
        const remaining = phase1End.getTime() - now.getTime()
        const statusText = formatTimeRemaining(remaining)
        
        return { 
          status: statusText,
          color: "blue", 
          progress,
          phase: "phase1",
          currentPhase: "优先获取",
          points: airdrop.phase1Points || 0
        }
      } else if (now >= phase1End && now < phase2End) {
        // 第二阶段：先到先得
        const totalDuration = phase2End.getTime() - start.getTime()
        const elapsed = now.getTime() - start.getTime()
        const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
        
        const remaining = phase2End.getTime() - now.getTime()
        const statusText = formatTimeRemaining(remaining)
        
        return { 
          status: statusText,
          color: "orange", 
          progress,
          phase: "phase2",
          currentPhase: "先到先得",
          points: airdrop.phase2Points || 0
        }
      } else {
        return { 
          status: "已结束", 
          color: "red", 
          progress: 100,
          phase: "ended",
          currentPhase: null,
          points: airdrop.phase2Points || 0
        }
      }
    } else {
      // 兼容旧格式的单阶段逻辑
      const end = parseUTC8Time(airdrop.endTime || "")
      
      if (now < start) {
        return { 
          status: "未开始", 
          color: "gray", 
          progress: 0,
          phase: "waiting",
          currentPhase: null,
          points: airdrop.points
        }
      } else if (now > end) {
        return { 
          status: "已结束", 
          color: "red", 
          progress: 100,
          phase: "ended",
          currentPhase: null,
          points: airdrop.points
        }
      } else {
        const total = end.getTime() - start.getTime()
        const elapsed = now.getTime() - start.getTime()
        const progress = Math.max(0, Math.min(100, (elapsed / total) * 100))
        
        const remaining = end.getTime() - now.getTime()
        const statusText = formatTimeRemaining(remaining)
        
        return { 
          status: statusText,
          color: "orange", 
          progress,
          phase: "single",
          currentPhase: null,
          points: airdrop.points
        }
      }
    }
  }

  // 格式化剩余时间的辅助函数
  const formatTimeRemaining = (remaining: number): string => {
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
    
    if (days > 0) {
      return `${days}天${hours}小时${minutes}分${seconds}秒后截止`
    } else if (hours > 0) {
      return `${hours}小时${minutes}分${seconds}秒后截止`
    } else if (minutes > 0) {
      return `${minutes}分${seconds}秒后截止`
    } else {
      return `${seconds}秒后截止`
    }
  }

  // 实时更新倒计时
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns: {[key: string]: any} = {}
      
      currentAirdrops.forEach((airdrop) => {
        newCountdowns[airdrop.token] = getAirdropStatus(airdrop)
      })
      
      setCountdowns(newCountdowns)
    }

    // 立即更新一次
    updateCountdowns()

    // 每秒更新
    const timer = setInterval(updateCountdowns, 1000)

    return () => clearInterval(timer)
  }, [currentAirdrops.length]) // 当空投数量变化时重新设置定时器

  // 使用 useMemo 处理数据，添加revenue计算字段
  const airdropHistoryData: AirdropHistoryItem[] = useMemo(() => {
    return historyRawData
      .filter(item => item.currentPrice) // 只处理有价格的历史数据
      .map(item => ({
        ...item,
        // 对于两阶段空投，使用优先获取阶段的积分作为主要积分
        points: item.phase1Points || item.points,
        currentValue: calculateCurrentValue(item.amount, item.supplementaryToken, item.currentPrice!),
        revenue: calculateRevenue(item.amount, item.supplementaryToken, item.currentPrice!, item.cost)
      }))
  }, [historyRawData])

  // 计算平均值用于显示在图表中
  const averagePoints = useMemo(() => {
    const total = airdropHistoryData.reduce((sum, item) => sum + item.points, 0)
    return Math.round(total / airdropHistoryData.length)
  }, [airdropHistoryData])

  const averageRevenue = useMemo(() => {
    const total = airdropHistoryData.reduce((sum, item) => sum + item.revenue, 0)
    return (total / airdropHistoryData.length).toFixed(2)
  }, [airdropHistoryData])

  // 简单的SVG图表组件 - 添加悬停功能
  const SimpleChart = () => {
    const width = 900
    const height = 400
    const paddingLeft = 60
    const paddingRight = 60
    const paddingTop = 20
    const paddingBottom = 40
    const chartWidth = width - paddingLeft - paddingRight
    const chartHeight = height - paddingTop - paddingBottom
    const xStep = chartWidth / (airdropHistoryData.length - 1) // 数据点间距

    // 按照要求设置刻度范围
    // 积分门槛：以50为一档，最高247，整到250就够了
    const maxThreshold = 250
    // 单号收益：以120为一档，最高520，整到600就够了
    const maxRevenue = 600

    // 生成刻度数组
    const thresholdTicks = [0, 50, 100, 150, 200, 250]
    const revenueTicks = [0, 120, 240, 360, 480, 600]

    // 生成路径 - 在图表区域内绘制
    const thresholdPath = airdropHistoryData
      .map((d, i) => {
        const x = paddingLeft + i * xStep
        const y = paddingTop + (chartHeight * (maxThreshold - d.points)) / maxThreshold
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    const revenuePath = airdropHistoryData
      .map((d, i) => {
        const x = paddingLeft + i * xStep
        const y = paddingTop + (chartHeight * (maxRevenue - d.revenue)) / maxRevenue
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    const handleMouseEnter = (event: React.MouseEvent, data: any, index: number) => {
      const x = paddingLeft + index * xStep
      const thresholdY = paddingTop + (chartHeight * (maxThreshold - data.points)) / maxThreshold
      const revenueY = paddingTop + (chartHeight * (maxRevenue - data.revenue)) / maxRevenue

      setHoveredPoint({
        x: x + 20, // 减小偏移，避免覆盖鼠标
        y: Math.max(10, Math.min(thresholdY, revenueY) - 140), // 更好的Y轴定位
        data,
        index,
      })
    }

    const handleMouseLeave = () => {
      setHoveredPoint(null)
    }

    const handleChartMouseLeave = () => {
      setHoveredPoint(null)
    }

    return (
      <div 
        className="w-full relative" 
        onMouseLeave={handleChartMouseLeave}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Y轴标签 - 积分门槛 (左侧) - 按50为一档显示 */}
          {thresholdTicks.map((tick, index) => {
            // 从底部开始，0在最下面
            const y = paddingTop + chartHeight - (index * chartHeight) / (thresholdTicks.length - 1)
            return (
              <text key={`threshold-tick-${tick}`} x={paddingLeft - 10} y={y + 5} fontSize="12" fill="#3b82f6" textAnchor="end">
                {tick}
              </text>
            )
          })}

          {/* Y轴标签 - 单号收益 (右侧) - 按120为一档显示 */}
          {revenueTicks.map((tick, index) => {
            // 从底部开始，0在最下面
            const y = paddingTop + chartHeight - (index * chartHeight) / (revenueTicks.length - 1)
            return (
              <text
                key={`revenue-tick-${tick}`}
                x={paddingLeft + chartWidth + 10}
                y={y + 5}
                fontSize="12"
                fill="#10b981"
                textAnchor="start"
              >
                {tick}
              </text>
            )
          })}

          {/* 悬停时的连接线 - 贯穿上下 */}
          {hoveredPoint && (
            <line
              x1={paddingLeft + hoveredPoint.index * xStep}
              y1={paddingTop}
              x2={paddingLeft + hoveredPoint.index * xStep}
              y2={paddingTop + chartHeight}
              stroke="#999"
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity="0.5"
            />
          )}

          {/* 积分门槛线 (蓝色) */}
          <path d={thresholdPath} fill="none" stroke="#3b82f6" strokeWidth="2" />

          {/* 单号收益线 (绿色) */}
          <path d={revenuePath} fill="none" stroke="#10b981" strokeWidth="2" />

          {/* 数据点和悬停区域 */}
          {airdropHistoryData.map((d, i) => {
            const x = paddingLeft + i * xStep
            const thresholdY = paddingTop + (chartHeight * (maxThreshold - d.points)) / maxThreshold
            const revenueY = paddingTop + (chartHeight * (maxRevenue - d.revenue)) / maxRevenue
            
            return (
              <g key={`point-group-${i}`}>
                {/* 更大的透明悬停区域 - 覆盖整个列区域 */}
                <rect
                  x={x - 20}
                  y={paddingTop}
                  width="40"
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(e, d, i)}
                />
                
                {/* 积分门槛点 */}
                <circle
                  cx={x}
                  cy={thresholdY}
                  r="4"
                  fill="#3b82f6"
                  className="pointer-events-none"
                />
                
                {/* 单号收益点 */}
                <circle
                  cx={x}
                  cy={revenueY}
                  r="4"
                  fill="#10b981"
                  className="pointer-events-none"
                />
              </g>
            )
          })}

          {/* X轴标签 - 动态显示5个标签 */}
          {(() => {
            const totalPoints = airdropHistoryData.length
            const labelCount = 5
            const step = Math.floor((totalPoints - 1) / (labelCount - 1))
            
            return airdropHistoryData.map((d, i) => {
              // 计算要显示的标签位置：0, step, 2*step, 3*step, 最后一个
              const shouldShow = i === 0 || 
                                i === step || 
                                i === step * 2 || 
                                i === step * 3 || 
                                i === totalPoints - 1
              
              if (shouldShow) {
                const x = paddingLeft + i * xStep
                return (
                  <text key={`label-${i}`} x={x} y={height - 10} fontSize="9" fill="#666" textAnchor="middle">
                    {d.date}
                  </text>
                )
              }
              return null
            })
          })()}
        </svg>

        {/* 悬停提示框 - 改进显示位置和响应 */}
        {hoveredPoint && (
          <div
            className="absolute z-50 bg-white/95 border border-gray-200 rounded-lg shadow-xl p-3 pointer-events-none backdrop-blur-sm min-w-48"
            style={{
              left: hoveredPoint.index > airdropHistoryData.length / 2 ? hoveredPoint.x - 220 : hoveredPoint.x + 20,
              top: hoveredPoint.y,
              maxWidth: '250px'
            }}
          >
            <div className="space-y-2">
              <div className="text-lg font-bold text-gray-900">{hoveredPoint.data.token}</div>
              <div className="text-xs text-gray-500">{hoveredPoint.data.date}</div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">积分门槛:</span>
                  <div className="flex flex-col items-end">
                    {hoveredPoint.data.phase1Points ? (
                      <>
                        <span className="text-xs font-medium text-blue-600">优先获取：{hoveredPoint.data.phase1Points} 分</span>
                        {hoveredPoint.data.phase2Points && (
                          <span className="text-xs font-medium text-orange-600">先到先得：{hoveredPoint.data.phase2Points} 分</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-medium text-blue-600">{hoveredPoint.data.points} 分</span>
                    )}
                    {!(hoveredPoint.data.pointsConsumed ?? true) && (
                      <span className="text-xs text-green-500">🎁 免费领取</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">空投数量:</span>
                  <span className="text-xs font-medium text-green-600">{hoveredPoint.data.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">补发代币:</span>
                  <span className="text-xs font-medium text-orange-600">{hoveredPoint.data.supplementaryToken.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">代币价格:</span>
                  <span className="text-xs font-medium text-orange-600">{hoveredPoint.data.currentPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">单号收益:</span>
                  <span className="text-xs font-medium text-green-600">${hoveredPoint.data.revenue.toFixed(2)}</span>
                </div>
                {hoveredPoint.data.cost && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">成本:</span>
                    <span className="text-xs font-medium text-red-600">${hoveredPoint.data.cost}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">参与人数:</span>
                  <span className="text-xs font-medium text-gray-700">{hoveredPoint.data.participants?.toLocaleString() || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">类型:</span>
                  <span
                    className={`text-xs font-medium ${hoveredPoint.data.type === "alpha" ? "text-blue-600" : "text-purple-600"}`}
                  >
                    {hoveredPoint.data.type}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 当前空投信息 */}
        <Card className="mb-8 shadow-2xl border border-blue-100/50 bg-gradient-to-br from-white via-blue-50/30 to-cyan-50/20 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 text-white rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              空投领取提醒
              <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                实时倒计时
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {currentAirdrops.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-100/50 min-h-[160px] flex items-center justify-center">
                <div className="text-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-medium text-gray-600">暂无进行中的空投</h3>
                      <p className="text-sm text-gray-500">请关注最新空投信息，及时参与领取</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {currentAirdrops.map((airdrop, index) => {
                  const statusInfo = countdowns[airdrop.token] || getAirdropStatus(airdrop)
                  return (
                    <div key={index} className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-100/50 hover:shadow-xl transition-all duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 左侧 */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-gray-800">{airdrop.token}</div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                airdrop.type === "alpha" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {airdrop.type.toUpperCase()}
                            </span>
                            {statusInfo.currentPhase && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                statusInfo.phase === "phase1" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                              }`}>
                                {statusInfo.currentPhase}阶段
                              </span>
                            )}
                          </div>
                          {/* 免费领取标注 */}
                          {!(airdrop.pointsConsumed ?? true) && (
                            <div className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded inline-block">
                              🎁 免费领取
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="text-gray-600 text-sm">
                              {airdrop.type === "tge" ? "分配数量" : "空投数量"}（枚）：
                              <span className="text-blue-600 font-medium">{airdrop.amount}</span>
                            </div>
                            
                            {/* 积分门槛信息 */}
                            {airdrop.phase1Points ? (
                              <>
                                <div className="text-gray-600 text-sm">
                                  优先获取积分门槛：<span className="text-blue-600 font-medium">{airdrop.phase1Points}分</span>
                                </div>
                                {airdrop.phase2Points && (
                                  <div className="text-gray-600 text-sm">
                                    先到先得积分门槛：<span className="text-orange-600 font-medium">{airdrop.phase2Points}分</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-gray-600 text-sm">
                                积分门槛：<span className="text-blue-600 font-medium">{airdrop.points}分</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 右侧 */}
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="text-gray-600">
                            {airdrop.type === "tge" ? "开始时间：" : "开始领取时间："}</span>
                            <span className="text-blue-600 ml-1">{airdrop.startTime}</span>
                          </div>
                          
                          {/* 时间信息 */}
                          {airdrop.phase1EndTime ? (
                            <>
                              <div className="text-sm">
                                <span className="text-gray-600">优先获取截止时间：</span>
                                <span className="text-blue-600 ml-1">{airdrop.phase1EndTime}</span>
                              </div>
                              {airdrop.phase2EndTime && (
                                <div className="text-sm">
                                  <span className="text-gray-600">先到先得截止时间：</span>
                                  <span className="text-orange-600 ml-1">{airdrop.phase2EndTime}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            airdrop.endTime && (
                              <div className="text-sm">
                                <span className="text-gray-600">
                                {airdrop.type === "tge" ? "截止时间：" : "截止领取时间："}</span>
                                <span className="text-orange-600 ml-1">{airdrop.endTime}</span>
                              </div>
                            )
                          )}
                          
                                                  <div className="text-sm">
                          <span className="text-gray-600">
                            {statusInfo.phase === "phase1" ? "优先获取倒计时：" : 
                             statusInfo.phase === "phase2" ? "先到先得倒计时：" : 
                             "倒计时："}
                          </span>
                          <span className={`font-medium ml-1 ${
                            statusInfo.color === "gray" ? "text-gray-600" : 
                            statusInfo.color === "red" ? "text-red-600" : 
                            statusInfo.color === "blue" ? "text-blue-600" : "text-orange-600"
                          }`}>
                            {statusInfo.status}
                          </span>
                        </div>
                        </div>
                      </div>
                      
                      {/* 进度条 - 双色进度条 */}
                      <div className="mt-4">
                        {airdrop.phase1EndTime && airdrop.phase2EndTime ? (
                          <div className="space-y-2">
                            {/* 双色进度条 */}
                            <div className="relative w-full bg-gray-200 rounded-full h-3">
                              {(() => {
                                const now = new Date()
                                const start = parseUTC8Time(airdrop.startTime)
                                const phase1End = parseUTC8Time(airdrop.phase1EndTime)
                                const phase2End = parseUTC8Time(airdrop.phase2EndTime)
                                const totalDuration = phase2End.getTime() - start.getTime()
                                const phase1Duration = phase1End.getTime() - start.getTime()
                                const phase1Percentage = (phase1Duration / totalDuration) * 100
                                
                                // 当前进度
                                let currentProgress = 0
                                if (now >= start) {
                                  const elapsed = now.getTime() - start.getTime()
                                  currentProgress = Math.min(100, (elapsed / totalDuration) * 100)
                                }
                                
                                return (
                                  <>
                                    {/* 第一阶段背景（蓝色区域） */}
                                    <div
                                      className="absolute top-0 left-0 h-3 bg-blue-100 rounded-l-full"
                                      style={{ width: `${phase1Percentage}%` }}
                                    ></div>
                                    
                                    {/* 第二阶段背景（橙色区域） */}
                                    <div
                                      className="absolute top-0 h-3 bg-orange-100 rounded-r-full"
                                      style={{ 
                                        left: `${phase1Percentage}%`, 
                                        width: `${100 - phase1Percentage}%` 
                                      }}
                                    ></div>
                                    
                                    {/* 实际进度 */}
                                    <div
                                      className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-300 ${
                                        currentProgress <= phase1Percentage ? "bg-blue-500" : "bg-gradient-to-r from-blue-500 via-blue-500 to-orange-500"
                                      }`}
                                      style={{ width: `${currentProgress}%` }}
                                    ></div>
                                    
                                    {/* 阶段分界线 */}
                                    <div
                                      className="absolute top-0 w-0.5 h-3 bg-gray-400"
                                      style={{ left: `${phase1Percentage}%` }}
                                    ></div>
                                  </>
                                )
                              })()}
                            </div>
                            
                            {/* 阶段标签 */}
                            <div className="relative flex text-xs h-5 pt-1">
                              {(() => {
                                const now = new Date()
                                const start = parseUTC8Time(airdrop.startTime)
                                const phase1End = parseUTC8Time(airdrop.phase1EndTime)
                                const phase2End = parseUTC8Time(airdrop.phase2EndTime)
                                const totalDuration = phase2End.getTime() - start.getTime()
                                const phase1Duration = phase1End.getTime() - start.getTime()
                                const phase1Percentage = (phase1Duration / totalDuration) * 100
                                
                                return (
                                  <>
                                    {/* 优先获取标签 - 在左侧 */}
                                    <span className={`absolute left-0 ${statusInfo.phase === "phase1" || statusInfo.phase === "waiting" ? "text-blue-600 font-medium" : "text-gray-500"}`}>
                                      优先获取 ({airdrop.phase1Points || 0}分)
                                    </span>
                                    
                                    {/* 先到先得标签 - 在第二阶段开始位置 */}
                                    <span 
                                      className={`absolute ${statusInfo.phase === "phase2" ? "text-orange-600 font-medium" : "text-gray-500"}`}
                                      style={{ left: `${phase1Percentage}%`, transform: 'translateX(-50%)' }}
                                    >
                                      先到先得 ({airdrop.phase2Points || 0}分)
                                    </span>
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        ) : (
                          // 单阶段进度条（兼容旧格式）
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                statusInfo.color === "gray" ? "bg-gray-400" : 
                                statusInfo.color === "red" ? "bg-red-500" : 
                                statusInfo.color === "blue" ? "bg-blue-500" : "bg-orange-500"
                              }`}
                              style={{ width: `${statusInfo.progress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xl border border-purple-100/50 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20 backdrop-blur-sm">
          <CardHeader className="p-0">
            <div className="flex w-full bg-gray-100 rounded-t-lg overflow-hidden">
              <button
                onClick={() => setActiveView("table")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 relative ${
                  activeView === "table"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span className="relative z-10">📊 数据表格</span>
                {activeView === "table" && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-blue-500 rounded-t-full"></div>
                )}
              </button>
              <button
                onClick={() => setActiveView("chart")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 relative ${
                  activeView === "chart"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span className="relative z-10">📈 历史曲线</span>
                {activeView === "chart" && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-blue-500 rounded-t-full"></div>
                )}
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {activeView === "table" ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                  <span className="font-medium">💡 提示：</span>
                  两阶段空投数据会在积分要求列显示"优先获取"和"先到先得"两个门槛，历史曲线以优先获取阶段为准展示趋势。
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-center py-3 px-4 font-medium">空投日期</th>
                        <th className="text-center py-3 px-4 font-medium">代币名称</th>
                        <th className="text-center py-3 px-4 font-medium">积分要求</th>
                        <th className="text-center py-3 px-4 font-medium">参与人数</th>
                        <th className="text-center py-3 px-4 font-medium">数量</th>
                        <th className="text-center py-3 px-4 font-medium">补发代币</th>
                        <th className="text-center py-3 px-4 font-medium">当天代币价格</th>
                        <th className="text-center py-3 px-4 font-medium">单号收益</th>
                        <th className="text-center py-3 px-4 font-medium">类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...airdropHistoryData].reverse().map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-light text-center">{item.date}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-blue-600 font-normal">{item.token}</span>
                              {/* 免费领取标注 */}
                              {!(item.pointsConsumed ?? true) && (
                                <div className="text-xs text-green-600 font-medium">🎁 免费领取</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {/* 积分要求列 - 特殊处理两阶段数据 */}
                            {item.phase1Points ? (
                              <div className="flex items-center justify-center space-x-1">
                                <span className="text-blue-600 font-light">{item.phase1Points}</span>
                                <span className="text-gray-400">/</span>
                                <span className="text-orange-600 font-light">{item.phase2Points || 0}</span>
                                <span className="text-gray-600 font-light text-sm">分</span>
                              </div>
                            ) : (
                              <span className="text-blue-600 font-light">{item.points} 分</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-light text-center">{item.participants?.toLocaleString() || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-blue-600 font-light">
                              {(typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-orange-600 font-light text-center">
                            {typeof item.supplementaryToken === 'string' ? parseFloat(item.supplementaryToken) : item.supplementaryToken}
                          </td>
                          <td className="py-3 px-4 font-light text-center">{item.currentPrice}</td>
                          <td className="py-3 px-4 text-green-600 font-normal text-center">${item.revenue.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.type === "alpha" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">历史趋势</h3>
                  <p className="text-sm text-gray-600 font-light mb-2">积分门槛和收益历史变化曲线</p>
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg mb-4">
                    <span className="font-medium">💡 提示：</span>
                    两阶段空投数据以优先获取阶段的积分门槛为准显示在曲线上，悬停查看详细信息。
                  </div>

                  {/* 图例和平均值 */}
                  <div className="flex justify-center gap-12 mb-4">
                    <div className="text-center">
                      <div className="flex items-center gap-2 justify-center mb-1">
                        <div className="w-4 h-0.5 bg-blue-500"></div>
                        <span className="text-sm text-gray-600">积分门槛</span>
                      </div>
                      <div className="text-lg font-bold text-blue-600">平均 {averagePoints} 分</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-2 justify-center mb-1">
                        <div className="w-4 h-0.5 bg-green-500"></div>
                        <span className="text-sm text-gray-600">单号收益</span>
                      </div>
                      <div className="text-lg font-bold text-green-600">平均 ${averageRevenue}</div>
                    </div>
                  </div>
                </div>

                <SimpleChart />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
