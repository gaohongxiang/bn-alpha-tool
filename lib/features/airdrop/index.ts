/**
 * 空投功能模块
 * 提供空投相关的计算和时间处理功能
 */

/**
 * 统一的数字字段标准化函数
 */
export function normalizeNumericField(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // 移除货币符号和其他非数字字符，保留小数点和负号
    const cleanValue = value.replace(/[$,\s]/g, '')
    const parsed = parseFloat(cleanValue)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

/**
 * 标准化空投数据项的所有数字字段
 */
export function normalizeAirdropItem<T extends Record<string, any>>(item: T): T {
  return {
    ...item,
    points: normalizeNumericField(item.points),
    phase1Points: item.phase1Points ? normalizeNumericField(item.phase1Points) : undefined,
    phase2Points: item.phase2Points ? normalizeNumericField(item.phase2Points) : undefined,
    amount: normalizeNumericField(item.amount),
    supplementaryToken: normalizeNumericField(item.supplementaryToken),
    participants: item.participants ? normalizeNumericField(item.participants) : null,
    cost: item.cost ? normalizeNumericField(item.cost) : undefined,
  }
}

/**
 * 计算总价值的辅助函数
 */
export function calculateCurrentValue(amount: number | string, supplementaryToken: number | string, currentPrice: string): string {
  const price = normalizeNumericField(currentPrice)
  const amountNum = normalizeNumericField(amount)
  const supplementaryTokenNum = normalizeNumericField(supplementaryToken)
  const totalAmount = amountNum + supplementaryTokenNum
  const totalValue = totalAmount * price
  return `${totalValue.toFixed(2)}`
}

/**
 * 计算单号收益的辅助函数
 */
export function calculateRevenue(amount: number | string, supplementaryToken: number | string, currentPrice: string, cost?: number): number {
  const price = normalizeNumericField(currentPrice)
  const amountNum = normalizeNumericField(amount)
  const supplementaryTokenNum = normalizeNumericField(supplementaryToken)
  const totalAmount = amountNum + supplementaryTokenNum
  const totalValue = totalAmount * price
  const costNum = normalizeNumericField(cost)
  const netRevenue = totalValue - costNum
  return parseFloat(netRevenue.toFixed(2))
}

/**
 * 将UTC+8时间字符串转换为Date对象
 */
export const parseUTC8Time = (timeStr: string): Date => {
  // 从 "2025-06-11 10:00 (UTC+8)" 中提取日期时间部分
  const match = timeStr.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
  if (!match) return new Date()

  const [, dateStr, timeStr2] = match
  // 创建UTC+8时间并转换为UTC
  const utc8Date = new Date(`${dateStr}T${timeStr2}:00+08:00`)
  return utc8Date
}

/**
 * 格式化剩余时间的辅助函数
 */
export const formatTimeRemaining = (remaining: number): string => {
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000)

  if (days > 0) {
    return `${days}天${hours}小时${minutes}分${seconds}秒后截止`
  } else if (hours > 0) {
    return `${hours}小时${minutes}分${seconds}秒后截止`
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒后截止`
  } else {
    return `${seconds}秒后截止`
  }
}