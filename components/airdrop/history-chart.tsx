"use client"

import React, { useState } from "react"
import type { AirdropHistoryItem } from "@/types/airdrop"

interface HistoryChartProps {
  airdropHistoryData: AirdropHistoryItem[]
  averagePoints: number
  averageRevenue: string
}

interface HoveredPoint {
  x: number
  y: number
  data: AirdropHistoryItem
  index: number
}

export function HistoryChart({ airdropHistoryData, averagePoints, averageRevenue }: HistoryChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null)

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
        // 确保 points 是数字类型
        const points = typeof d.points === 'string' ? parseFloat(d.points) : d.points
        const y = paddingTop + (chartHeight * (maxThreshold - points)) / maxThreshold
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    const revenuePath = airdropHistoryData
      .map((d, i) => {
        const x = paddingLeft + i * xStep
        // 确保 revenue 是数字类型
        const revenue = typeof d.revenue === 'string' ? parseFloat(d.revenue) : d.revenue
        const y = paddingTop + (chartHeight * (maxRevenue - revenue)) / maxRevenue
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    const handleMouseEnter = (event: React.MouseEvent, data: AirdropHistoryItem, index: number) => {
      const x = paddingLeft + index * xStep
      // 确保 points 和 revenue 是数字类型
      const points = typeof data.points === 'string' ? parseFloat(data.points) : data.points
      const revenue = typeof data.revenue === 'string' ? parseFloat(data.revenue) : data.revenue
      const thresholdY = paddingTop + (chartHeight * (maxThreshold - points)) / maxThreshold
      const revenueY = paddingTop + (chartHeight * (maxRevenue - revenue)) / maxRevenue

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
            // 确保 points 和 revenue 是数字类型
            const points = typeof d.points === 'string' ? parseFloat(d.points) : d.points
            const revenue = typeof d.revenue === 'string' ? parseFloat(d.revenue) : d.revenue
            const thresholdY = paddingTop + (chartHeight * (maxThreshold - points)) / maxThreshold
            const revenueY = paddingTop + (chartHeight * (maxRevenue - revenue)) / maxRevenue
            
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
                  <span className="text-xs font-medium text-green-600">
                    {(typeof hoveredPoint.data.amount === 'string' ? parseFloat(hoveredPoint.data.amount) : hoveredPoint.data.amount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">补发代币:</span>
                  <span className="text-xs font-medium text-orange-600">
                    {(typeof hoveredPoint.data.supplementaryToken === 'string' ? parseFloat(hoveredPoint.data.supplementaryToken) : hoveredPoint.data.supplementaryToken).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">代币价格:</span>
                  <span className="text-xs font-medium text-orange-600">{hoveredPoint.data.currentPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">单号收益:</span>
                  <span className="text-xs font-medium text-green-600">
                    ${(typeof hoveredPoint.data.revenue === 'string' ? parseFloat(hoveredPoint.data.revenue) : hoveredPoint.data.revenue).toFixed(2)}
                  </span>
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
  )
} 