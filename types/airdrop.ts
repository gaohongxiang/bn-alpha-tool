// 定义统一的空投数据类型
export interface AirdropItem {
  id?: number  // 数据库ID，新增时可选
  date: string
  token: string
  points: number
  participants: number | null
  amount: number  // 统一为数字类型
  supplementaryToken: number  // 统一为数字类型
  currentPrice: string | null
  type: "alpha" | "tge" | "preTge"

  cost?: number  // TGE项目的成本（可选）
  pointsConsumed?: boolean  // 可选字段，默认为true
  // 时间字段（仅当status为current或upcoming时需要）
  startTime?: string // 格式: "2025-06-19 20:00 (UTC+8)"
  // 简化的两阶段字段
  phase1Points?: number
  phase2Points?: number
  phase1EndTime?: string
  phase2EndTime?: string
  // 兼容旧格式的结束时间
  endTime?: string   // 格式: "2025-06-12 10:00 (UTC+8)"
  description?: string
  
  // 数据库时间戳
  createdAt?: Date
  updatedAt?: Date
}

// 历史数据类型（带计算字段）
export interface AirdropHistoryItem extends AirdropItem {
  currentValue: string
  revenue: number
}

// 当前空投数据类型
export interface CurrentAirdropItem extends AirdropItem {
  startTime: string // 必需字段
  phase1Points?: number
  phase2Points?: number
  phase1EndTime?: string
  phase2EndTime?: string
  endTime?: string   // 兼容旧格式
}

// 空投状态信息
export interface AirdropStatusInfo {
  status: string
  color: "gray" | "red" | "blue" | "orange"
  progress: number
  phase: "waiting" | "phase1" | "phase2" | "single" | "ended"
  currentPhase: string | null
  points: number
} 