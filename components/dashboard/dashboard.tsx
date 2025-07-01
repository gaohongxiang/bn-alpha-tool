"use client"

import { Calculator, BarChart3, Clock, BookOpen, AlertTriangle, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface DashboardProps {
  setActiveTab: (tab: string) => void
}

export function Dashboard({ setActiveTab }: DashboardProps) {
  const [showAlert, setShowAlert] = useState(true)

  const features = [
    {
      id: "points-calculator",
      icon: Calculator,
      title: "收益计算器",
      description: "根据当前余额与目标积分，快速计算每日所需交易量。",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
    },
    {
      id: "revenue-display",
      icon: BarChart3,
      title: "交易统计",
      description: "批量查询交易履历信息，统计交易数据和收益情况。",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      id: "airdrop-history",
      icon: Clock,
      title: "空投历史",
      description: "查看历史市安 Alpha 空投数据，包含领取门槛、单笔收益、历史曲线等。",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      id: "rules-explanation",
      icon: BookOpen,
      title: "规则详解",
      description: "详细解读市安 Alpha 积分与空投规则，帮助你快速入门。",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
  ]

  const handleCloseAlert = () => {
    setShowAlert(false)
  }

  const handleCardClick = (featureId: string) => {
    setActiveTab(featureId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card
                key={feature.id}
                className={`hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 ${feature.borderColor} border-2 bg-white`}
                onClick={() => handleCardClick(feature.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${feature.bgColor} shadow-sm`}>
                      <Icon className={`w-7 h-7 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-xl font-medium text-gray-800">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed text-gray-600 font-light">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
