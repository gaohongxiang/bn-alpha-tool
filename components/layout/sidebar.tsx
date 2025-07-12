"use client"

import { cn } from "@/lib/core/utils"
import { Calculator, BarChart3, Clock, BookOpen } from "lucide-react"

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    {
      id: "points-calculator",
      label: "收益计算器",
      icon: Calculator,
      theme: "from-orange-600 via-yellow-600 to-amber-600"
    },
    {
      id: "revenue-display",
      label: "交易统计",
      icon: BarChart3,
      theme: "from-green-600 via-emerald-600 to-teal-600"
    },
    {
      id: "airdrop-history",
      label: "空投历史",
      icon: Clock,
      theme: "from-blue-600 via-cyan-600 to-teal-600"
    },
    {
      id: "rules-explanation",
      label: "规则详解",
      icon: BookOpen,
      theme: "from-rose-600 via-pink-600 to-pink-500"
    },
  ]

  // 获取当前页面的主题色
  const getCurrentTheme = () => {
    const currentItem = menuItems.find(item => item.id === activeTab)
    return currentItem?.theme || "from-gray-600 to-gray-800" // 默认灰色
  }

  const handleLogoClick = () => {
    setActiveTab("dashboard")
  }

  const handleMenuClick = (tabId: string) => {
    setActiveTab(tabId)
  }

  return (
    <div className={`w-full bg-gradient-to-r ${getCurrentTheme()} border-b border-white/20 backdrop-blur-md transition-all duration-500 shadow-lg`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <div className="relative w-10 h-10 flex items-center justify-center shadow-xl group-hover:shadow-2xl transition-all duration-300">
              {/* 币安风格菱形背景 */}
              <div className="absolute w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 transform rotate-45 rounded-sm group-hover:rotate-90 transition-transform duration-500"></div>
              <div className="absolute w-6 h-6 bg-gradient-to-br from-yellow-300 to-amber-400 transform rotate-45 rounded-sm opacity-80"></div>
              <span className="relative text-amber-900 font-bold text-sm z-10 drop-shadow-sm">α</span>
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-white drop-shadow-sm leading-tight">
                <div className="text-sm font-bold tracking-wider">BINANCE</div>
                <div className="text-sm font-medium tracking-wide">Alpha Tool</div>
              </div>
            </div>
          </div>
          <nav className="flex-1">
            <ul className="flex items-center justify-center gap-8">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleMenuClick(item.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 px-4 py-3 rounded-xl text-center transition-all duration-300 group",
                        activeTab === item.id
                          ? "bg-white/25 text-white font-semibold shadow-2xl backdrop-blur-md border border-white/40 scale-105"
                          : "text-white/80 hover:bg-white/15 hover:text-white hover:scale-105 font-medium hover:shadow-lg",
                      )}
                    >
                      <Icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="text-sm font-medium drop-shadow-sm">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="w-10 h-10"></div>
        </div>
      </div>
    </div>
  )
}
