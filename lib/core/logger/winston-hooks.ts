/**
 * Winston 日志系统的 React Hooks
 * 为 React 组件提供简洁的日志接口
 */

import { useCallback } from 'react'
import { logger, type LogLevel } from './winston-logger'

/**
 * 主要的日志 Hook
 */
export function useLogger() {
  const startSession = useCallback((sessionId: string, metadata?: Record<string, any>) => {
    logger.startSession(sessionId, metadata)
  }, [])

  const endSession = useCallback(() => {
    logger.endSession()
  }, [])

  const debug = useCallback((category: string, message: string, meta?: any) => {
    logger.debug(category, message, meta)
  }, [])

  const info = useCallback((category: string, message: string, meta?: any) => {
    logger.info(category, message, meta)
  }, [])

  const warn = useCallback((category: string, message: string, meta?: any) => {
    logger.warn(category, message, meta)
  }, [])

  const error = useCallback((category: string, message: string, meta?: any) => {
    logger.error(category, message, meta)
  }, [])

  const verbose = useCallback((category: string, message: string, meta?: any) => {
    logger.verbose(category, message, meta)
  }, [])

  const safeExecute = useCallback(<T>(fn: () => T, fallback: T, context?: string): T => {
    return logger.safeExecute(fn, fallback, context)
  }, [])

  const safeExecuteAsync = useCallback(async <T>(fn: () => Promise<T>, fallback: T, context?: string): Promise<T> => {
    return logger.safeExecuteAsync(fn, fallback, context)
  }, [])

  const getCurrentSession = useCallback(() => {
    return logger.getCurrentSession()
  }, [])

  return {
    // 会话管理
    startSession,
    endSession,
    getCurrentSession,

    // 日志方法
    debug,
    info,
    warn,
    error,
    verbose,

    // 安全执行
    safeExecute,
    safeExecuteAsync
  }
}

/**
 * 专门用于会话管理的 Hook
 */
export function useLoggerSession() {
  const startSession = useCallback((sessionId: string, metadata?: Record<string, any>) => {
    logger.startSession(sessionId, metadata)
  }, [])

  const endSession = useCallback(() => {
    logger.endSession()
  }, [])

  const getCurrentSession = useCallback(() => {
    return logger.getCurrentSession()
  }, [])

  return {
    startSession,
    endSession,
    getCurrentSession
  }
}

/**
 * 用于特定类别的日志 Hook
 */
export function useCategoryLogger(category: string) {
  const debug = useCallback((message: string, meta?: any) => {
    logger.debug(category, message, meta)
  }, [category])

  const info = useCallback((message: string, meta?: any) => {
    logger.info(category, message, meta)
  }, [category])

  const warn = useCallback((message: string, meta?: any) => {
    logger.warn(category, message, meta)
  }, [category])

  const error = useCallback((message: string, meta?: any) => {
    logger.error(category, message, meta)
  }, [category])

  const verbose = useCallback((message: string, meta?: any) => {
    logger.verbose(category, message, meta)
  }, [category])

  return {
    debug,
    info,
    warn,
    error,
    verbose
  }
}

// 导出类型
export type { LogLevel }
