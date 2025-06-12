/**
 * 配置初始化文件
 * 在应用启动时自动初始化配置管理器
 */

import React from 'react'
import { configManager, type AppConfig } from './config-manager'

let initializationPromise: Promise<void> | null = null

/**
 * 初始化应用配置
 * 确保配置只初始化一次
 */
export async function initializeConfig(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = configManager.initialize()
  return initializationPromise
}

/**
 * 检查配置是否已初始化
 */
export function isConfigInitialized(): boolean {
  try {
    configManager.getConfig()
    return true
  } catch {
    return false
  }
}

/**
 * 获取配置管理器（确保已初始化）
 */
export async function getConfigManager() {
  if (!isConfigInitialized()) {
    await initializeConfig()
  }
  return configManager
}

/**
 * React Hook: 使用配置
 */
export function useConfig() {
  const [config, setConfig] = React.useState<AppConfig | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true)
        await initializeConfig()
        setConfig(configManager.getConfig())
        setError(null)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  return { config, loading, error, configManager }
}

// 自动初始化（在浏览器环境中）
if (typeof window !== 'undefined') {
  initializeConfig().catch(error => {
    console.error('应用配置初始化失败:', error)
  })
} 