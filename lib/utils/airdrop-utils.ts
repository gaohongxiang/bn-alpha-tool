// 计算总价值的辅助函数
export function calculateCurrentValue(amount: number | string, supplementaryToken: number | string, currentPrice: string): string {
  const price = parseFloat(currentPrice.replace('$', ''))
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount
  const supplementaryTokenNum = typeof supplementaryToken === 'string' ? parseFloat(supplementaryToken) : supplementaryToken
  const totalAmount = amountNum + supplementaryTokenNum
  const totalValue = totalAmount * price
  return `$${totalValue.toFixed(2)}`
}

// 计算单号收益的辅助函数
export function calculateRevenue(amount: number | string, supplementaryToken: number | string, currentPrice: string, cost?: number): number {
  const price = parseFloat(currentPrice.replace('$', ''))
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount
  const supplementaryTokenNum = typeof supplementaryToken === 'string' ? parseFloat(supplementaryToken) : supplementaryToken
  const totalAmount = amountNum + supplementaryTokenNum
  const totalValue = totalAmount * price
  const netRevenue = totalValue - (cost || 0)
  return parseFloat(netRevenue.toFixed(2))
}

// 将UTC+8时间字符串转换为Date对象
export const parseUTC8Time = (timeStr: string): Date => {
  // 从 "2025-06-11 10:00 (UTC+8)" 中提取日期时间部分
  const match = timeStr.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
  if (!match) return new Date()
  
  const [, dateStr, timeStr2] = match
  // 创建UTC+8时间并转换为UTC
  const utc8Date = new Date(`${dateStr}T${timeStr2}:00+08:00`)
  return utc8Date
}

// 格式化剩余时间的辅助函数
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