/**
 * UI组件Props类型定义
 * 统一管理所有组件的Props接口
 */

import type React from "react"
import type { Wallet, WalletData } from './wallet'

// Revenue组件相关类型
export interface RevenueDisplayProps {
  wallets?: Wallet[]
  setWallets?: React.Dispatch<React.SetStateAction<Wallet[]>>
  walletData?: WalletData[]
  setWalletData?: React.Dispatch<React.SetStateAction<WalletData[]>>
  hasQueried?: boolean
  setHasQueried?: React.Dispatch<React.SetStateAction<boolean>>
}

// API响应类型（用于前端组件）
export interface AnalyzeResponse {
  success: boolean
  data?: {
    wallets: WalletData[]
    summary: {
      totalWallets: number
      successCount: number
      errorCount: number
      totalBalance: number
      totalVolume: number
      totalPoints: number
      processingTime: number
    }
  }
  error?: string
}

// 数据导出相关类型
export interface ExportDataRequest {
  selectedDate: string
  walletData: WalletData[]
  totalStats?: {
    totalWallets: number
    successCount: number
    errorCount: number
    totalBalance: number
    totalVolume: number
    totalPoints: number
  }
}

export interface ExportDataResponse {
  success: boolean
  filePath?: string
  message?: string
  error?: string
  details?: string
}

// 日志保存相关类型
export interface SaveLogRequest {
  fileName: string
  content: string
  append?: boolean
}

export interface SaveLogResponse {
  success: boolean
  filePath?: string
  message?: string
  error?: string
  details?: string
}

// 通用表格组件Props
export interface DataTableProps<T> {
  data: T[]
  columns: Array<{
    key: keyof T
    label: string
    sortable?: boolean
    render?: (value: any, item: T) => React.ReactNode
  }>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  loading?: boolean
  emptyMessage?: string
}

// 查询控制组件Props
export interface QueryControlsProps {
  selectedDate: string
  onDateChange: (date: string) => void
  onQuery: () => void
  loading?: boolean
  disabled?: boolean
}

// 模态框组件Props
export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
}

// 交易详情模态框Props
export interface TransactionModalProps extends ModalProps {
  walletData?: WalletData
}

// 规则设置模态框Props
export interface RulesModalProps extends ModalProps {
  onSave?: (rules: any) => void
}
