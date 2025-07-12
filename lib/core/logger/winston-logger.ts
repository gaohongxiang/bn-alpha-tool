/**
 * 混合日志系统
 * 服务端: 真正的 Winston (仅在 API 路由中使用)
 * 客户端: 简单的 console 包装
 */

// 检查是否在服务端环境
const isServer = typeof window === 'undefined'

// 导出类型
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'

// 会话信息
interface SessionInfo {
  id: string
  startTime: number
  metadata?: Record<string, any>
}

// 服务端 Winston 实例 (延迟初始化)
let serverWinstonLogger: any = null

/**
 * 混合日志管理器
 * 服务端使用 Winston，客户端使用简单 console
 */
class WinstonLogger {
  private static instance: WinstonLogger
  private currentSession: SessionInfo | null = null

  private constructor() {
    // 不在构造函数中初始化Winston，避免客户端导入问题
    this.logSystemInfo()
  }

  static getInstance(): WinstonLogger {
    if (!WinstonLogger.instance) {
      WinstonLogger.instance = new WinstonLogger()
    }
    return WinstonLogger.instance
  }

  /**
   * 手动初始化服务端 Winston (已弃用，使用API专用日志器)
   * 注意：此方法已被api-logger.ts替代
   */
  async initializeWinston() {
    // 此方法已弃用，Winston初始化现在在API路由中直接处理
    console.warn('⚠️ initializeWinston已弃用，请在API路由中使用api-logger.ts')
  }

  private logSystemInfo(): void {
    const message = isServer ? 
      '🚀 混合日志系统初始化 (服务端: Winston, 客户端: Console)' :
      '🚀 混合日志系统初始化 (客户端模式)'
    
    this.info('system', message, {
      isServer,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })
  }

  // 会话管理
  startSession(sessionId: string, metadata?: Record<string, any>): void {
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      metadata
    }
    this.info('session', `开始新会话: ${sessionId}`, metadata)
  }

  endSession(): void {
    if (this.currentSession) {
      const duration = Date.now() - this.currentSession.startTime
      this.info('session', `结束会话: ${this.currentSession.id}`, {
        duration: `${duration}ms`,
        ...this.currentSession.metadata
      })
      this.currentSession = null
    }
  }

  getCurrentSession(): SessionInfo | null {
    return this.currentSession
  }

  // 日志方法
  error(category: string, message: string, meta?: any): void {
    this.log('error', category, message, meta)
  }

  warn(category: string, message: string, meta?: any): void {
    this.log('warn', category, message, meta)
  }

  info(category: string, message: string, meta?: any): void {
    this.log('info', category, message, meta)
  }

  debug(category: string, message: string, meta?: any): void {
    this.log('debug', category, message, meta)
  }

  verbose(category: string, message: string, meta?: any): void {
    this.log('verbose', category, message, meta)
  }

  private log(level: LogLevel, category: string, message: string, meta?: any): void {
    const logData = {
      message,
      category,
      session: this.currentSession?.id,
      ...meta
    }

    if (isServer && serverWinstonLogger) {
      // 服务端使用 Winston
      serverWinstonLogger.log(level, message, logData)
    } else {
      // 客户端使用简单 console
      const timestamp = new Date().toLocaleString()
      const sessionInfo = this.currentSession?.id ? ` [${this.currentSession.id}]` : ''
      const prefix = `[${timestamp}]${sessionInfo} ${level.toUpperCase()} ${category}:`

      const consoleMethod = level === 'error' ? console.error :
                           level === 'warn' ? console.warn :
                           console.log

      if (meta && Object.keys(meta).length > 0) {
        consoleMethod(prefix, message, '|', JSON.stringify(meta))
      } else {
        consoleMethod(prefix, message)
      }
    }
  }

  // 设置服务端Winston实例（由API路由调用）
  setServerWinston(winstonInstance: any): void {
    if (isServer) {
      serverWinstonLogger = winstonInstance
    }
  }

  // 安全执行
  safeExecute<T>(fn: () => T, fallback: T, context?: string): T {
    try {
      return fn()
    } catch (error) {
      this.error('safe-execute', `${context || '函数执行'} 失败: ${error}`, { error })
      return fallback
    }
  }

  async safeExecuteAsync<T>(fn: () => Promise<T>, fallback: T, context?: string): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      this.error('safe-execute-async', `${context || '异步函数执行'} 失败: ${error}`, { error })
      return fallback
    }
  }

  getWinstonInstance(): any {
    return isServer ? serverWinstonLogger : null
  }
}

// 创建全局实例
export const logger = WinstonLogger.getInstance()

// 导出类
export { WinstonLogger }
