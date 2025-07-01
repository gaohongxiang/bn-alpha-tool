"use client"

import React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Dashboard } from "@/components/dashboard/dashboard"
import { PointsCalculator } from "@/components/points/points-calculator"
import { AirdropHistory } from "@/components/airdrop/airdrop-history"
import { RevenueDisplay } from "@/components/revenue/revenue-display"
import { RulesExplanation } from "@/components/rules/rules-explanation"
import { useUIStore } from "@/stores/ui-store"
import { useWalletStore } from "@/stores/wallet-store"

/**
 * App Shell - 客户端组件
 * 处理所有客户端交互、状态管理和页面导航
 */
export function AppShell() {
  const { activeTab, setActiveTab } = useUIStore()
  const { 
    wallets, 
    setWallets, 
    walletData, 
    setWalletData, 
    hasQueried, 
    setHasQueried 
  } = useWalletStore()

  // 创建适配器函数以兼容React的Dispatch<SetStateAction<T>>类型
  const walletsAdapter = (value: React.SetStateAction<typeof wallets>) => {
    if (typeof value === 'function') {
      setWallets(value(wallets))
    } else {
      setWallets(value)
    }
  }

  const walletDataAdapter = (value: React.SetStateAction<typeof walletData>) => {
    if (typeof value === 'function') {
      setWalletData(value(walletData))
    } else {
      setWalletData(value)
    }
  }

  const hasQueriedAdapter = (value: React.SetStateAction<typeof hasQueried>) => {
    if (typeof value === 'function') {
      setHasQueried(value(hasQueried))
    } else {
      setHasQueried(value)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard setActiveTab={setActiveTab} />
      case "points-calculator":
        return <PointsCalculator />
      case "revenue-display":
        return (
          <RevenueDisplay
            wallets={wallets}
            setWallets={walletsAdapter}
            walletData={walletData}
            setWalletData={walletDataAdapter}
            hasQueried={hasQueried}
            setHasQueried={hasQueriedAdapter}
          />
        )
      case "airdrop-history":
        return <AirdropHistory />
      case "rules-explanation":
        return <RulesExplanation />
      default:
        return <Dashboard setActiveTab={setActiveTab} />
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1">{renderContent()}</main>
    </div>
  )
} 