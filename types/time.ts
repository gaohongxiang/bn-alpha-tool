/**
 * 时间相关类型定义
 */

export interface DayTimeRange {
  startTimestamp: number // 当天开始时间戳 (UTC 00:00:00)
  endTimestamp: number   // 结束时间戳 (当天结束或当前时间)
  startISO: string       // 开始时间ISO格式
  endISO: string         // 结束时间ISO格式
  dayStr: string         // 日期字符串 (YYYY-MM-DD)
  isCompleted: boolean   // 当天是否已结束
}