// 统一的调试日志工具
export class DebugLogger {
  private static isDevelopment = process.env.NODE_ENV === 'development'
  
  static log(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.log(message, ...args)
    }
  }
  
  static error(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.error(message, ...args)
    }
  }
  
  static warn(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.warn(message, ...args)
    }
  }
  
  static info(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.info(message, ...args)
    }
  }
  
  static debug(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.debug(message, ...args)
    }
  }
  
  // 检查是否为开发环境
  static get isDev(): boolean {
    return this.isDevelopment
  }
}

// 导出简化的调试函数
export const debugLog = DebugLogger.log.bind(DebugLogger)
export const debugError = DebugLogger.error.bind(DebugLogger)
export const debugWarn = DebugLogger.warn.bind(DebugLogger)
export const debugInfo = DebugLogger.info.bind(DebugLogger) 