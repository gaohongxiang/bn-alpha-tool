/**
 * 空投数据验证模块
 * 实现数据互斥约束和完整性检查
 */

import type { AirdropItem } from '@/types/airdrop'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * 验证空投数据的完整性和互斥约束
 */
export function validateAirdropData(data: Partial<AirdropItem>): ValidationResult {
  const errors: ValidationError[] = []

  // 1. 必填字段验证
  if (!data.date?.trim()) {
    errors.push({ field: 'date', message: '空投日期不能为空' })
  }

  if (!data.token?.trim()) {
    errors.push({ field: 'token', message: '代币名称不能为空' })
  }

  // 2. 积分字段互斥验证（可选）
  const hasPoints = data.points !== null && data.points !== undefined && data.points > 0
  const hasPhasePoints = (data.phase1Points !== null && data.phase1Points !== undefined && data.phase1Points > 0) ||
    (data.phase2Points !== null && data.phase2Points !== undefined && data.phase2Points > 0)

  if (hasPoints && hasPhasePoints) {
    errors.push({
      field: 'points',
      message: '不能同时设置单阶段积分和两阶段积分，请选择其中一种模式'
    })
  }

  // 3. 两阶段积分完整性验证
  if (hasPhasePoints) {
    if (!data.phase1Points || data.phase1Points <= 0) {
      errors.push({ field: 'phase1Points', message: '两阶段模式下，优先获取积分必须大于0' })
    }
    if (!data.phase2Points || data.phase2Points <= 0) {
      errors.push({ field: 'phase2Points', message: '两阶段模式下，先到先得积分必须大于0' })
    }
  }

  // 4. 时间字段互斥验证（仅当有startTime时才验证）
  if (data.startTime?.trim()) {
    const hasEndTime = data.endTime?.trim()
    const hasPhaseEndTimes = data.phase1EndTime?.trim() || data.phase2EndTime?.trim()

    if (hasEndTime && hasPhaseEndTimes) {
      errors.push({
        field: 'endTime',
        message: '不能同时设置单阶段结束时间和两阶段结束时间，请选择其中一种模式'
      })
    }

    // 如果设置了两阶段积分，必须设置两阶段时间
    if (hasPhasePoints && !hasPhaseEndTimes) {
      errors.push({
        field: 'phase1EndTime',
        message: '两阶段积分模式下，必须设置两阶段结束时间'
      })
    }

    // 如果设置了单阶段积分，建议设置单阶段结束时间
    if (hasPoints && !hasEndTime && !hasPhaseEndTimes) {
      errors.push({
        field: 'endTime',
        message: '单阶段积分模式下，建议设置结束时间'
      })
    }

    // 两阶段时间完整性验证
    if (hasPhaseEndTimes) {
      if (!data.phase1EndTime?.trim()) {
        errors.push({ field: 'phase1EndTime', message: '两阶段模式下，优先获取结束时间不能为空' })
      }
      if (!data.phase2EndTime?.trim()) {
        errors.push({ field: 'phase2EndTime', message: '两阶段模式下，先到先得结束时间不能为空' })
      }
    }
  }

  // 5. 时间格式验证
  if (data.startTime?.trim() && !isValidTimeFormat(data.startTime)) {
    errors.push({ field: 'startTime', message: '开始时间格式不正确，请使用 "YYYY-MM-DD HH:mm" 或 "YYYY-MM-DD" 格式' })
  }

  if (data.endTime?.trim() && !isValidTimeFormat(data.endTime)) {
    errors.push({ field: 'endTime', message: '结束时间格式不正确，请使用 "YYYY-MM-DD HH:mm" 或 "YYYY-MM-DD" 格式' })
  }

  if (data.phase1EndTime?.trim() && !isValidTimeFormat(data.phase1EndTime)) {
    errors.push({ field: 'phase1EndTime', message: '优先获取结束时间格式不正确，请使用 "YYYY-MM-DD HH:mm" 格式' })
  }

  if (data.phase2EndTime?.trim() && !isValidTimeFormat(data.phase2EndTime)) {
    errors.push({ field: 'phase2EndTime', message: '先到先得结束时间格式不正确，请使用 "YYYY-MM-DD HH:mm" 格式' })
  }

  // 6. 数值范围验证
  if (data.participants !== null && data.participants !== undefined && data.participants < 0) {
    errors.push({ field: 'participants', message: '参与人数不能为负数' })
  }

  if (data.cost !== null && data.cost !== undefined && data.cost < 0) {
    errors.push({ field: 'cost', message: '成本不能为负数' })
  }

  // 7. 价格格式验证
  if (data.currentPrice?.trim() && !isValidPriceFormat(data.currentPrice)) {
    errors.push({ field: 'currentPrice', message: '价格格式不正确，请输入数字（如：0.095）' })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 验证时间格式是否正确
 */
function isValidTimeFormat(timeStr: string): boolean {
  if (!timeStr) return false

  // 支持多种用户友好的格式：
  // 1. "2025-06-11 10:00 (UTC+8)" - 完整时间格式（兼容旧数据）
  // 2. "2025-06-11 10:00" - 简化时间格式（推荐）
  // 3. "2025-06-11" - 仅日期格式
  const fullTimeWithTzPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC\+8\)$/
  const fullTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

  const trimmed = timeStr.trim()
  return fullTimeWithTzPattern.test(trimmed) || 
         fullTimePattern.test(trimmed) || 
         dateOnlyPattern.test(trimmed)
}

/**
 * 验证价格格式是否正确
 * 支持纯数字格式，程序会自动添加 $ 符号
 */
function isValidPriceFormat(priceStr: string): boolean {
  if (!priceStr) return true // 价格是可选的

  // 支持格式：0.123, 1.23, 12.34 (纯数字)
  // 也支持：$0.123, $1.23, $12.34 (带$符号)
  const numericPattern = /^\d+(\.\d+)?$/
  const dollarPattern = /^\$\d+(\.\d+)?$/

  const trimmed = priceStr.trim()
  return numericPattern.test(trimmed) || dollarPattern.test(trimmed)
}

/**
 * 清理和标准化空投数据
 */
export function sanitizeAirdropData(data: Partial<AirdropItem>): Partial<AirdropItem> {
  const sanitized = { ...data }

  // 清理字符串字段
  if (sanitized.date) {
    const trimmed = sanitized.date.trim()
    // 将 YYYY-MM-DD 格式转换为 YYYY年MM月DD日 格式
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-')
      sanitized.date = `${year}年${month}月${day}日`
    } else {
      sanitized.date = trimmed
    }
  }
  if (sanitized.token) sanitized.token = sanitized.token.trim().toUpperCase()
  if (sanitized.currentPrice) {
    const trimmed = sanitized.currentPrice.trim()
    // 如果是纯数字，自动添加 $ 符号
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      sanitized.currentPrice = `$${trimmed}`
    } else {
      sanitized.currentPrice = trimmed
    }
  }
  if (sanitized.description) sanitized.description = sanitized.description.trim()
  if (sanitized.startTime) sanitized.startTime = sanitized.startTime.trim()
  if (sanitized.endTime) sanitized.endTime = sanitized.endTime.trim()
  if (sanitized.phase1EndTime) sanitized.phase1EndTime = sanitized.phase1EndTime.trim()
  if (sanitized.phase2EndTime) sanitized.phase2EndTime = sanitized.phase2EndTime.trim()

  // 清理数值字段 - 只有当值存在且不为空时才转换
  if (sanitized.amount !== undefined && sanitized.amount !== null) {
    sanitized.amount = Number(sanitized.amount)
  }
  if (sanitized.supplementaryToken !== undefined && sanitized.supplementaryToken !== null) {
    sanitized.supplementaryToken = Number(sanitized.supplementaryToken)
  }
  if (sanitized.points !== undefined && sanitized.points !== null) {
    sanitized.points = Number(sanitized.points)
  }
  if (sanitized.phase1Points !== undefined && sanitized.phase1Points !== null) {
    sanitized.phase1Points = Number(sanitized.phase1Points)
  }
  if (sanitized.phase2Points !== undefined && sanitized.phase2Points !== null) {
    sanitized.phase2Points = Number(sanitized.phase2Points)
  }
  if (sanitized.participants !== undefined && sanitized.participants !== null) {
    sanitized.participants = Number(sanitized.participants)
  }
  if (sanitized.cost !== undefined && sanitized.cost !== null) {
    sanitized.cost = Number(sanitized.cost)
  }

  // 根据互斥约束清理字段
  const hasPoints = sanitized.points !== null && sanitized.points !== undefined && sanitized.points > 0
  const hasPhasePoints = (sanitized.phase1Points !== null && sanitized.phase1Points !== undefined && sanitized.phase1Points > 0) ||
    (sanitized.phase2Points !== null && sanitized.phase2Points !== undefined && sanitized.phase2Points > 0)

  // 如果选择了单阶段积分，清除两阶段积分
  if (hasPoints && !hasPhasePoints) {
    sanitized.phase1Points = undefined
    sanitized.phase2Points = undefined
    sanitized.phase1EndTime = undefined
    sanitized.phase2EndTime = undefined
  }

  // 如果选择了两阶段积分，清除单阶段积分
  if (hasPhasePoints && !hasPoints) {
    sanitized.points = undefined
    sanitized.endTime = undefined
  }

  return sanitized
}

/**
 * 检查代币名称是否已存在（用于创建时的唯一性检查）
 */
export function validateTokenUniqueness(token: string, existingTokens: string[], currentToken?: string): ValidationError | null {
  if (!token?.trim()) return null

  const normalizedToken = token.trim().toUpperCase()
  const normalizedCurrent = currentToken?.trim().toUpperCase()

  // 如果是编辑模式且代币名称没有改变，则不需要检查
  if (normalizedCurrent && normalizedToken === normalizedCurrent) {
    return null
  }

  if (existingTokens.map(t => t.toUpperCase()).includes(normalizedToken)) {
    return { field: 'token', message: `代币 "${token}" 已存在，请使用其他名称` }
  }

  return null
}
