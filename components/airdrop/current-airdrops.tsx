"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import type { CurrentAirdropItem, AirdropStatusInfo } from "@/types/airdrop"
import { parseUTC8Time, formatTimeRemaining, isDateOnlyFormat } from "@/lib/features/airdrop"

interface CurrentAirdropsProps {
  currentAirdrops: CurrentAirdropItem[]
  onRefresh?: () => void
  loading?: boolean
}

export function CurrentAirdrops({ currentAirdrops, onRefresh, loading }: CurrentAirdropsProps) {
  // 实时倒计时状态
  const [countdowns, setCountdowns] = useState<{ [key: string]: AirdropStatusInfo }>({})

  // 获取当前空投的状态信息
  const getAirdropStatus = (airdrop: CurrentAirdropItem): AirdropStatusInfo => {
    const now = new Date()
    const start = parseUTC8Time(airdrop.startTime)

    // 如果startTime只有日期格式，显示"今日开放"，不显示倒计时
    if (isDateOnlyFormat(airdrop.startTime)) {
      const today = new Date()
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

      if (startDate.getTime() === todayDate.getTime()) {
        return {
          status: "今日开放",
          color: "blue",
          progress: 0, // 不显示进度，因为不知道具体时间
          phase: "single",
          currentPhase: null,
          points: airdrop.phase1Points || airdrop.points || 0
        }
      } else if (startDate > todayDate) {
        return {
          status: "即将开放",
          color: "gray",
          progress: 0,
          phase: "waiting",
          currentPhase: null,
          points: airdrop.phase1Points || airdrop.points || 0
        }
      } else {
        return {
          status: "已结束",
          color: "red",
          progress: 100,
          phase: "ended",
          currentPhase: null,
          points: airdrop.phase1Points || airdrop.points || 0
        }
      }
    }

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

  // 实时更新倒计时
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns: { [key: string]: AirdropStatusInfo } = {}

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

  return (
    <Card className="mb-8 shadow-2xl border border-blue-100/50 bg-gradient-to-br from-white via-blue-50/30 to-cyan-50/20 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 text-white rounded-t-lg py-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="w-5 h-5" />
          空投领取提醒
          <Badge variant="secondary" className="bg-white/20 text-white text-xs">
            实时倒计时
          </Badge>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="group relative p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 rounded-full flex items-center justify-center ml-2"
            >
              <svg 
                className={`w-4 h-4 transition-transform duration-300 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
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
                          className={`px-2 py-1 rounded-full text-xs font-medium ${airdrop.type === "alpha" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                            }`}
                        >
                          {airdrop.type.toUpperCase()}
                        </span>
                        {statusInfo.currentPhase && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.phase === "phase1" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
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
                        <span className={`font-medium ml-1 ${statusInfo.color === "gray" ? "text-gray-600" :
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
                                  className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-300 ${currentProgress <= phase1Percentage ? "bg-blue-500" : "bg-gradient-to-r from-blue-500 via-blue-500 to-orange-500"
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
                          className={`h-2 rounded-full transition-all duration-300 ${statusInfo.color === "gray" ? "bg-gray-400" :
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
  )
} 