"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CurrentAirdrops } from "./current-airdrops"

import { HistoryChart } from "./history-chart"
import { HistoryTable } from "./history-table"
import type { AirdropItem, AirdropHistoryItem, CurrentAirdropItem } from "@/types/airdrop"
import { calculateCurrentValue, calculateRevenue, normalizeNumericField, parseUTC8Time, isDateOnlyFormat } from "@/lib/features/airdrop"

export function AirdropHistory() {
  const [activeView, setActiveView] = useState("chart") // 默认显示历史曲线
  const [allData, setAllData] = useState<AirdropItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 优化的数据加载函数，简化重试逻辑
  const loadAirdropData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)

      const method = forceRefresh ? 'POST' : 'GET'
      const url = '/api/airdrop'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        // 设置合理的超时时间
        signal: AbortSignal.timeout(12000) // 12秒超时，给后端足够时间
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success && result.data) {
        setAllData(result.data)
        console.log(`✅ 成功加载 ${result.count || 0} 条空投数据`)
      } else {
        setError(result.error || '服务器返回异常数据')
      }
    } catch (err) {
      console.error('加载空投数据失败:', err)

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('请求超时，请检查网络连接后重试')
        } else if (err.message.includes('Failed to fetch')) {
          setError('网络连接失败，请检查网络状态')
        } else {
          setError(err.message || '加载数据时发生未知错误')
        }
      } else {
        setError('加载数据时发生未知错误')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAirdropData()
  }, [loadAirdropData])

  // 从合并的数据中分离当前空投和历史数据
  const currentAirdrops: CurrentAirdropItem[] = useMemo(() => {
    return (allData.filter(item => item.startTime) as CurrentAirdropItem[])
      .sort((a, b) => {
        const timeA = parseUTC8Time(a.startTime)
        const timeB = parseUTC8Time(b.startTime)
        
        // 1. 按开始时间升序排序：离开始最近的在前
        const dateA = new Date(timeA.getFullYear(), timeA.getMonth(), timeA.getDate())
        const dateB = new Date(timeB.getFullYear(), timeB.getMonth(), timeB.getDate())
        
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime() // 升序：早开始的日期在前
        }
        
        // 2. 同一天内，有具体时间的排在前面
        const hasTimeA = !isDateOnlyFormat(a.startTime)
        const hasTimeB = !isDateOnlyFormat(b.startTime)
        
        if (hasTimeA && !hasTimeB) return -1  // A有时间，B只有日期 -> A在前
        if (!hasTimeA && hasTimeB) return 1   // A只有日期，B有时间 -> B在前
        
        // 3. 都有时间或都只有日期时，按时间排序
        return timeA.getTime() - timeB.getTime() // 升序：早的时间在前
      })
  }, [allData])

  const historyRawData: AirdropItem[] = useMemo(() =>
    allData.filter(item => !item.startTime)
    , [allData])

  // 使用 useMemo 处理数据，添加revenue计算字段
  const airdropHistoryData: AirdropHistoryItem[] = useMemo(() => {
    return historyRawData
      .filter(item => item.currentPrice) // 只处理有价格的历史数据
      .map(item => ({
        ...item,
        // 对于两阶段空投，使用优先获取阶段的积分作为主要积分，并标准化为数字
        points: normalizeNumericField(item.phase1Points || item.points),
        currentValue: calculateCurrentValue(item.amount, item.supplementaryToken, item.currentPrice!),
        revenue: calculateRevenue(item.amount, item.supplementaryToken, item.currentPrice!, item.cost)
      }))
      .sort((a, b) => {
        // 按日期排序（从早到晚：4月在左边，8月在右边）
        const parseDate = (dateStr: string) => {
          const match = dateStr.match(/(\d{4})年(\d{2})月(\d{2})日/)
          if (match) {
            const [, year, month, day] = match
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          }
          return new Date(dateStr) // 备用解析
        }

        const dateA = parseDate(a.date)
        const dateB = parseDate(b.date)
        return dateA.getTime() - dateB.getTime() // 升序：早的在左边
      })
  }, [historyRawData])

  // 计算平均值用于显示在图表中
  const averagePoints = useMemo(() => {
    const total = airdropHistoryData.reduce((sum, item) => {
      // 确保 points 是数字类型
      const points = typeof item.points === 'string' ? parseFloat(item.points) : item.points
      return sum + points
    }, 0)
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
        <CurrentAirdrops
          currentAirdrops={currentAirdrops}
          onRefresh={() => loadAirdropData(true)}
          loading={loading}
        />

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <Card className="shadow-2xl border border-purple-100/50 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20 backdrop-blur-sm">
          <CardHeader className="p-0">
            <div className="flex w-full bg-gray-100 rounded-t-lg overflow-hidden">
              <button
                onClick={() => setActiveView("table")}
                className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 relative ${activeView === "table"
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
                className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 relative ${activeView === "chart"
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
              <HistoryTable
                airdropHistoryData={airdropHistoryData}
              />
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
