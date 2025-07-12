/**
 * 纯服务端API日志器
 * 只在API路由中使用，完全避免客户端导入问题
 */

import winston from 'winston'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let apiLogger: winston.Logger | null = null
let isInitialized = false
let logBuffer: string[] = []  // 缓存所有日志用于写入统一文件
let currentSessionId: string | null = null

/**
 * 生成会话日志文件名
 */
function getSessionLogFileName(sessionId: string | null): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const sessionName = sessionId ? sessionId.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_') : 'session'
  return `${sessionName}_${timestamp}.log`
}

/**
 * 初始化API专用日志器
 */
export async function initializeApiLogger(sessionId?: string): Promise<winston.Logger> {
  // 如果有新的会话ID，重新初始化
  if (sessionId && sessionId !== currentSessionId) {
    apiLogger = null
    isInitialized = false
    currentSessionId = sessionId
  }

  if (apiLogger && isInitialized) {
    return apiLogger
  }

  try {
    // 清空日志缓存
    logBuffer = []

    // 检查是否在 Vercel 等无服务器环境中
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY

    const transports: winston.transport[] = [
      // 控制台输出 (彩色)
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf((info: any) => {
            const { timestamp, level, message, category, session, ...meta } = info
            const sessionInfo = session ? ` [${session}]` : ''
            const categoryInfo = category ? ` ${category.toUpperCase()}` : ''
            const metaInfo = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : ''
            const logLine = `[${timestamp}]${sessionInfo} ${level}${categoryInfo}: ${message}${metaInfo}`

            // 缓存日志到内存中
            logBuffer.push(logLine)

            return logLine
          })
        )
      })
    ]

    // 只在非无服务器环境中添加文件传输
    if (!isServerless) {
      try {
        const logDir = join(process.cwd(), 'data', 'runtime', 'logs')

        // 确保日志目录存在
        if (!existsSync(logDir)) {
          mkdirSync(logDir, { recursive: true })
        }

        // 为每个会话创建独立的日志文件
        transports.push(new winston.transports.File({
          filename: join(logDir, getSessionLogFileName(currentSessionId)),
          maxsize: 20 * 1024 * 1024,  // 20MB
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf((info: any) => {
              const { timestamp, level, message, category, session, ...meta } = info
              const sessionInfo = session ? ` [${session}]` : ''
              const categoryInfo = category ? ` ${category.toUpperCase()}` : ''
              const metaInfo = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : ''
              return `[${timestamp}]${sessionInfo} ${level.toUpperCase()}${categoryInfo}: ${message}${metaInfo}`
            })
          )
        }))
      } catch (fileError) {
        console.warn('无法创建文件日志传输，仅使用控制台输出:', fileError)
      }
    }

    // 创建 Winston 实例
    apiLogger = winston.createLogger({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'MM/DD/YYYY, h:mm:ss A' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports
      // 移除异常和拒绝处理器，减少日志文件数量
    })

    isInitialized = true
    console.log('🚀 API专用Winston日志系统初始化完成')
    
    return apiLogger
  } catch (error) {
    console.error('❌ API日志器初始化失败:', error)
    throw error
  }
}

/**
 * 获取API日志器实例
 */
export function getApiLogger(): winston.Logger | null {
  return apiLogger
}

/**
 * 记录会话开始
 */
export function logSessionStart(sessionId: string, metadata?: Record<string, any>) {
  if (apiLogger) {
    apiLogger.info(`开始新会话: ${sessionId}`, { 
      category: 'session', 
      session: sessionId, 
      ...metadata 
    })
  }
}

/**
 * 记录会话结束
 */
export function logSessionEnd(sessionId: string, duration: number, metadata?: Record<string, any>) {
  if (apiLogger) {
    apiLogger.info(`结束会话: ${sessionId}`, { 
      category: 'session', 
      session: sessionId, 
      duration: `${duration}ms`,
      ...metadata 
    })
  }
}

/**
 * 便捷的日志方法
 */
export function logInfo(category: string, message: string, meta?: any) {
  if (apiLogger) {
    apiLogger.info(message, { category, ...meta })
  }
}

export function logError(category: string, message: string, meta?: any) {
  if (apiLogger) {
    apiLogger.error(message, { category, ...meta })
  }
}

export function logWarn(category: string, message: string, meta?: any) {
  if (apiLogger) {
    apiLogger.warn(message, { category, ...meta })
  }
}

export function logDebug(category: string, message: string, meta?: any) {
  if (apiLogger) {
    apiLogger.debug(message, { category, ...meta })
  }
}

/**
 * 获取所有缓存的日志内容
 */
export function getAllCachedLogs(): string {
  return logBuffer.join('\n')
}

/**
 * 清空日志缓存
 */
export function clearLogBuffer(): void {
  logBuffer = []
}
