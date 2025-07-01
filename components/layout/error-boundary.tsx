'use client'

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 只在开发环境下记录错误
    if (process.env.NODE_ENV === 'development') {
      console.error('React Error Boundary 捕获到错误:', error, errorInfo)
    }

    // 检查是否为第三方扩展错误
    const isExtensionError = error.stack?.includes('chrome-extension://') ||
                            error.stack?.includes('moz-extension://') ||
                            error.stack?.includes('injectedScript') ||
                            error.message?.includes('not found method')

    if (isExtensionError) {
      // 如果是扩展错误，重置错误状态继续渲染
      this.setState({ hasError: false, error: undefined })
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // 检查是否为第三方扩展错误
      const isExtensionError = this.state.error.stack?.includes('chrome-extension://') ||
                              this.state.error.stack?.includes('moz-extension://') ||
                              this.state.error.stack?.includes('injectedScript') ||
                              this.state.error.message?.includes('not found method')

      if (isExtensionError) {
        // 如果是扩展错误，直接渲染子组件
        return this.props.children
      }

      // 只有在非扩展错误时才显示错误界面
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                应用出现了错误
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                请刷新页面重试，如果问题持续存在，请联系开发者。
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                刷新页面
              </button>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    错误详情（开发模式）
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
} 