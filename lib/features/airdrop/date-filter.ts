import type { AirdropItem, AirdropHistoryItem } from '@/types/airdrop'

/**
 * 日期过滤工具函数
 */

export type DateFilterType = boolean

/**
 * 解析日期字符串，支持多种格式
 */
export function parseAirdropDate(dateStr: string): Date | null {
  if (!dateStr) return null
  
  try {
    // 支持中文格式：2025年09月03日
    if (dateStr.includes('年')) {
      const match = dateStr.match(/(\d{4})年(\d{2})月(\d{2})日/)
      if (match) {
        const [, year, month, day] = match
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    }
    
    // 支持标准格式：2025-09-03 或 2025/09/03
    const normalizedDate = dateStr.replace(/[年月]/g, '-').replace(/日/g, '').replace(/\//g, '-')
    const date = new Date(normalizedDate)
    
    // 检查是否为有效日期
    if (isNaN(date.getTime())) {
      console.warn(`无法解析日期: ${dateStr}`)
      return null
    }
    
    return date
  } catch (error) {
    console.warn(`日期解析错误: ${dateStr}`, error)
    return null
  }
}

/**
 * 获取指定天数前的日期
 */
export function getDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0) // 设置为当天开始
  return date
}

/**
 * 检查日期是否在30天范围内
 */
export function isDateInRange(itemDate: Date, filterEnabled: DateFilterType): boolean {
  if (!filterEnabled) return true
  
  const now = new Date()
  now.setHours(23, 59, 59, 999) // 设置为当天结束
  
  const cutoffDate = getDaysAgo(30)
  
  return itemDate >= cutoffDate && itemDate <= now
}

/**
 * 过滤空投数据
 */
export function filterAirdropsByDate<T extends AirdropItem | AirdropHistoryItem>(
  items: T[], 
  filterEnabled: DateFilterType
): T[] {
  if (!filterEnabled) return items
  
  return items.filter(item => {
    const itemDate = parseAirdropDate(item.date)
    if (!itemDate) return false
    
    return isDateInRange(itemDate, filterEnabled)
  })
}

/**
 * 获取过滤统计信息
 */
export interface FilterStats {
  total: number
  filtered: number
  percentage: number
  dateRange: {
    start: string
    end: string
  } | null
}

export function getFilterStats<T extends AirdropItem | AirdropHistoryItem>(
  allItems: T[], 
  filteredItems: T[],
  filterEnabled: DateFilterType
): FilterStats {
  const total = allItems.length
  const filtered = filteredItems.length
  const percentage = total > 0 ? Math.round((filtered / total) * 100) : 0
  
  let dateRange: FilterStats['dateRange'] = null
  
  if (filterEnabled) {
    const start = getDaysAgo(30)
    const end = new Date()
    
    dateRange = {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  }
  
  return {
    total,
    filtered,
    percentage,
    dateRange
  }
}

/**
 * 格式化过滤描述
 */
export function getFilterDescription(filterEnabled: DateFilterType, stats: FilterStats): string {
  if (filterEnabled) {
    return `显示最近30天的空投数据 (${stats.filtered}/${stats.total}条)`
  } else {
    return `显示全部空投数据 (${stats.total}条)`
  }
}
