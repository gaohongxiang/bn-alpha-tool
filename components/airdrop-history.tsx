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
  amount: number
  supplementaryToken: number
  currentPrice: string | null
  type: "alpha" | "tge"
  pointsConsumed?: boolean  // 可选字段，默认为true
  // 时间字段（可选，有则为当前空投）
  startTime?: string // 格式: "2025-06-11 10:00 (UTC+8)"
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
  endTime: string   // 必需字段
}

// 计算总价值的辅助函数
function calculateCurrentValue(amount: number, supplementaryToken: number, currentPrice: string): string {
  const price = parseFloat(currentPrice.replace('$', ''))
  const totalAmount = amount + supplementaryToken
  const totalValue = totalAmount * price
  return `$${totalValue.toFixed(2)}`
}

// 计算单号收益的辅助函数
function calculateRevenue(amount: number, supplementaryToken: number, currentPrice: string): number {
  const price = parseFloat(currentPrice.replace('$', ''))
  const totalAmount = amount + supplementaryToken
  const totalValue = totalAmount * price
  return parseFloat(totalValue.toFixed(2))
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
    item.startTime && item.endTime
  ) as CurrentAirdropItem[]
  const historyRawData: AirdropItem[] = allData.filter(item => 
    !item.startTime || !item.endTime
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
    const end = parseUTC8Time(airdrop.endTime)
    
    if (now < start) {
      return { status: "未开始", color: "gray", progress: 0 }
    } else if (now > end) {
      return { status: "已结束", color: "red", progress: 100 }
    } else {
      const total = end.getTime() - start.getTime()
      const elapsed = now.getTime() - start.getTime()
      const progress = Math.max(0, Math.min(100, (elapsed / total) * 100))
      
      const remaining = end.getTime() - now.getTime()
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
      
      let statusText = ""
      if (days > 0) {
        statusText = `${days}天${hours}小时${minutes}分${seconds}秒后截止`
      } else if (hours > 0) {
        statusText = `${hours}小时${minutes}分${seconds}秒后截止`
      } else if (minutes > 0) {
        statusText = `${minutes}分${seconds}秒后截止`
      } else {
        statusText = `${seconds}秒后截止`
      }
      
      return { 
        status: statusText, 
        color: "orange", 
        progress 
      }
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
        currentValue: calculateCurrentValue(item.amount, item.supplementaryToken, item.currentPrice!),
        revenue: calculateRevenue(item.amount, item.supplementaryToken, item.currentPrice!)
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
    // 积分门槛：以60为一档，最高235，整到240就够了
    const maxThreshold = 240
    // 单号收益：以120为一档，最高520，整到600就够了
    const maxRevenue = 600

    // 生成刻度数组
    const thresholdTicks = [0, 60, 120, 180, 240]
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
          {/* Y轴标签 - 积分门槛 (左侧) - 按60为一档显示 */}
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
                    <span className="text-xs font-medium text-blue-600">{hoveredPoint.data.points} 分</span>
                    <span className={`text-xs ${(hoveredPoint.data.pointsConsumed ?? true) ? 'text-red-500' : 'text-green-500'}`}>
                      {(hoveredPoint.data.pointsConsumed ?? true) ? '消耗积分' : '免费领取'}
                    </span>
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
                        </div>
                        <div className="space-y-1">
                          <div className="text-gray-600 text-sm">空投数量（枚）：<span className="text-blue-600 font-medium">{airdrop.amount}</span></div>
                          <div className="text-gray-600 text-sm">
                            积分门槛（分）：<span className="text-blue-600 font-medium">{airdrop.points}</span>
                            <span className={`ml-2 text-xs ${(airdrop.pointsConsumed ?? true) ? 'text-red-500' : 'text-green-500'}`}>
                              {(airdrop.pointsConsumed ?? true) ? '(消耗积分)' : '(免费领取)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 右侧 */}
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="text-gray-600">开始领取时间：</span>
                          <span className="text-blue-600 ml-1">{airdrop.startTime}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">截止领取时间：</span>
                          <span className="text-blue-600 ml-1">{airdrop.endTime}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">倒计时：</span>
                          <span className={`font-medium ml-1 ${
                            statusInfo.color === "gray" ? "text-gray-600" : 
                            statusInfo.color === "red" ? "text-red-600" : "text-blue-600"
                          }`}>
                            {statusInfo.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 进度条 - 放在最下面一行 */}
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            statusInfo.color === "gray" ? "bg-gray-400" : 
                            statusInfo.color === "red" ? "bg-red-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${statusInfo.progress}%` }}
                        ></div>
                      </div>
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">空投日期</th>
                      <th className="text-left py-3 px-4 font-medium">代币名称</th>
                      <th className="text-left py-3 px-4 font-medium">积分要求</th>
                      <th className="text-left py-3 px-4 font-medium">参与人数</th>
                      <th className="text-left py-3 px-4 font-medium">空投数量</th>
                      <th className="text-left py-3 px-4 font-medium">补发代币</th>
                      <th className="text-left py-3 px-4 font-medium">当天代币价格</th>
                      <th className="text-left py-3 px-4 font-medium">单号收益</th>
                      <th className="text-left py-3 px-4 font-medium">类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...airdropHistoryData].reverse().map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-light">{item.date}</td>
                        <td className="py-3 px-4">
                          <span className="text-blue-600 font-normal">{item.token}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="text-blue-600 font-light">{item.points} 分</span>
                            <span className={`text-xs ${(item.pointsConsumed ?? true) ? 'text-red-500' : 'text-green-500'}`}>
                              {(item.pointsConsumed ?? true) ? '消耗积分' : '免费领取'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-light">{item.participants?.toLocaleString() || '-'}</td>
                        <td className="py-3 px-4">
                          <span className="text-blue-600 font-light">{item.amount.toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4 text-orange-600 font-light">{item.supplementaryToken}</td>
                        <td className="py-3 px-4 font-light">{item.currentPrice}</td>
                        <td className="py-3 px-4 text-green-600 font-normal">${item.revenue.toFixed(2)}</td>
                        <td className="py-3 px-4">
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
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">历史趋势</h3>
                  <p className="text-sm text-gray-600 font-light mb-4">积分门槛和收益历史变化曲线</p>

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
