"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { PointsCalculator } from "@/components/points-calculator"
import { AirdropHistory } from "@/components/airdrop-history"
import { RevenueDisplay } from "@/components/revenue-display"
import { RulesExplanation } from "@/components/rules-explanation"

// 定义钱包相关的类型
interface Wallet {
  address: string
  note: string
}

interface TokenBalance {
  symbol: string
  balance: number
  usdValue: number
  contractAddress?: string
}

interface WalletData {
  address: string
  note: string
  totalBalance: number
  tokenBalances: TokenBalance[]
  tradingVolume: number
  transactionCount: number
  estimatedPoints: number
  revenue: number
  gasUsed: number
  tradingLoss: number
  gasLoss: number
  isLoading?: boolean
  error?: string
}

export default function Home() {
  // Default to dashboard to show the cards
  const [activeTab, setActiveTab] = useState("dashboard")

  // 将钱包状态提升到主组件级别
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [walletData, setWalletData] = useState<WalletData[]>([])
  const [hasQueried, setHasQueried] = useState(false)

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
            setWallets={setWallets}
            walletData={walletData}
            setWalletData={setWalletData}
            hasQueried={hasQueried}
            setHasQueried={setHasQueried}
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
