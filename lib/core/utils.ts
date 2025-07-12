import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 验证并清理钱包地址
 */
export function validateAndCleanWalletAddress(walletAddress: string): string {
  if (!walletAddress) {
    throw new Error('钱包地址不能为空')
  }
  
  // 移除空格并转换为小写
  const cleanAddress = walletAddress.trim().toLowerCase()
  
  // 检查是否为有效的以太坊地址格式
  if (!/^0x[a-fA-F0-9]{40}$/i.test(cleanAddress)) {
    throw new Error('钱包地址格式无效，请输入有效的以太坊地址（0x + 40位十六进制字符）')
  }
  
  return cleanAddress
}

/**
 * 验证并清理日期字符串
 */
export function validateAndCleanDateString(dateStr: string): string {
  if (!dateStr) {
    throw new Error('日期不能为空')
  }
  
  const cleanDateStr = dateStr.trim()
  
  // 检查日期格式 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
    throw new Error('日期格式无效，请使用 YYYY-MM-DD 格式，例如：2025-01-15')
  }
  
  // 检查日期是否有效
  const date = new Date(cleanDateStr)
  if (isNaN(date.getTime())) {
    throw new Error('日期无效，请输入有效的日期')
  }
  
  // 检查日期不能是未来（使用UTC时间）
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0) // 重置到当天UTC开始
  
  const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  
  if (dateUTC > today) {
    throw new Error('不能查询未来日期的数据')
  }
  
  // 检查日期不能太久远（比如不能早于2020年）
  const minDate = new Date(Date.UTC(2020, 0, 1))
  if (dateUTC < minDate) {
    throw new Error('不支持查询2020年之前的数据')
  }
  
  return cleanDateStr
}
