// 全局错误处理器，防止第三方扩展干扰应用运行

interface ErrorInfo {
  message: string
  source?: string
  filename?: string
  lineno?: number
  colno?: number
  stack?: string
}

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler
  private isDevelopment = process.env.NODE_ENV === 'development'
  private ignoredSources = [
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'edge-extension://'
  ]

  private constructor() {
    this.initializeErrorHandling()
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  private initializeErrorHandling() {
    if (typeof window === 'undefined') return

    // 处理未捕获的JavaScript错误
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message,
        source: event.error?.name,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      })
    })

    // 处理Promise rejection错误
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        message: event.reason?.message || String(event.reason),
        source: 'Promise rejection',
        stack: event.reason?.stack
      })
    })

    // 处理React错误边界未捕获的错误
    if (this.isDevelopment) {
      const originalConsoleError = console.error
      console.error = (...args) => {
        const message = args.join(' ')
        if (!this.shouldIgnoreError(message)) {
          originalConsoleError.apply(console, args)
        }
      }
    }
  }

  private handleError(errorInfo: ErrorInfo) {
    // 检查是否为第三方扩展错误
    if (this.shouldIgnoreError(errorInfo.filename || errorInfo.message)) {
      // 静默处理第三方扩展错误，只在开发环境下记录
      if (this.isDevelopment) {
        console.warn('🔕 忽略第三方扩展错误:', errorInfo.message)
      }
      return
    }

    // 只在开发环境下输出应用错误
    if (this.isDevelopment) {
      console.error('🚨 应用错误:', errorInfo)
    }

    // 生产环境下可以发送错误报告到监控系统
    if (!this.isDevelopment) {
      this.reportError(errorInfo)
    }
  }

  private shouldIgnoreError(source: string): boolean {
    if (!source) return false
    
    return this.ignoredSources.some(ignoredSource => 
      source.includes(ignoredSource)
    ) || source.includes('injectedScript') ||
       source.includes('contentScript') ||
       source.includes('not found method')
  }

  private reportError(errorInfo: ErrorInfo) {
    // 这里可以集成错误监控服务，如 Sentry, LogRocket 等
    // 目前只是静默处理
    console.warn('Error reported to monitoring service:', errorInfo.message)
  }

  // 提供手动错误处理方法
  public static safeExecute<T>(
    fn: () => T, 
    fallback: T, 
    errorContext?: string
  ): T {
    try {
      return fn()
    } catch (error) {
      const instance = GlobalErrorHandler.getInstance()
      instance.handleError({
        message: error instanceof Error ? error.message : String(error),
        source: errorContext || 'Manual execution',
        stack: error instanceof Error ? error.stack : undefined
      })
      return fallback
    }
  }

  public static async safeExecuteAsync<T>(
    fn: () => Promise<T>, 
    fallback: T, 
    errorContext?: string
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      const instance = GlobalErrorHandler.getInstance()
      instance.handleError({
        message: error instanceof Error ? error.message : String(error),
        source: errorContext || 'Manual async execution',
        stack: error instanceof Error ? error.stack : undefined
      })
      return fallback
    }
  }
}

// 初始化全局错误处理器
export const errorHandler = GlobalErrorHandler.getInstance()

// 导出静态方法供其他模块使用
export const { safeExecute, safeExecuteAsync } = GlobalErrorHandler 