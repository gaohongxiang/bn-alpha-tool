"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import airdropAllData from "@/data/airdrop-history.json"
import { CurrentAirdrops } from "./current-airdrops"
import { HistoryTable } from "./history-table"
import { HistoryChart } from "./history-chart"
import type { AirdropItem, AirdropHistoryItem, CurrentAirdropItem } from "@/types/airdrop"
import { calculateCurrentValue, calculateRevenue } from "@/lib/utils/airdrop-utils"

export function AirdropHistory() {
  const [activeView, setActiveView] = useState("chart") // 默认显示历史曲线

  // 从合并的数据中分离当前空投和历史数据
  const allData = airdropAllData as AirdropItem[]
  const currentAirdrops: CurrentAirdropItem[] = allData.filter(item => 
    item.startTime && (item.phase1EndTime || item.endTime)
  ) as CurrentAirdropItem[]
  const historyRawData: AirdropItem[] = allData.filter(item => 
    !item.startTime || (!item.phase1EndTime && !item.endTime)
  )

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 当前空投信息 */}
        <CurrentAirdrops currentAirdrops={currentAirdrops} />

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
              <HistoryTable airdropHistoryData={airdropHistoryData} />
            ) : (
              <HistoryChart 
                airdropHistoryData={airdropHistoryData}
                averagePoints={averagePoints}
                averageRevenue={averageRevenue}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
