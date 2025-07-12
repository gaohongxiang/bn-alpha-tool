/**
 * 通用工具类型定义
 * 包含项目中常用的工具类型和泛型
 */

// 基础状态类型
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// 排序方向
export type SortOrder = 'asc' | 'desc'

// 网络状态
export type NetworkStatus = 'online' | 'offline' | 'connecting'

// 操作结果类型
export interface OperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp?: number
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
  total?: number
}

// 分页结果
export interface PaginatedResult<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// 时间范围
export interface TimeRange {
  start: Date | string
  end: Date | string
}

// 键值对类型
export type KeyValuePair<K = string, V = any> = {
  key: K
  value: V
}

// 选项类型
export interface Option<T = string> {
  label: string
  value: T
  disabled?: boolean
  description?: string
}

// 表单字段类型
export interface FormField<T = any> {
  name: string
  label: string
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'textarea' | 'checkbox' | 'radio'
  value?: T
  placeholder?: string
  required?: boolean
  disabled?: boolean
  options?: Option<T>[]
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    custom?: (value: T) => boolean | string
  }
}

// 过滤器类型
export interface Filter<T = any> {
  field: keyof T
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn'
  value: any
}

// 搜索参数
export interface SearchParams<T = any> {
  query?: string
  filters?: Filter<T>[]
  sort?: {
    field: keyof T
    order: SortOrder
  }
  pagination?: PaginationParams
}

// 环境类型
export type Environment = 'development' | 'staging' | 'production' | 'test'

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 主题类型
export type Theme = 'light' | 'dark' | 'auto'

// 语言类型
export type Language = 'zh-CN' | 'en-US' | 'ja-JP'

// 货币类型
export type Currency = 'USD' | 'CNY' | 'EUR' | 'JPY' | 'BTC' | 'ETH'

// 文件类型
export interface FileInfo {
  name: string
  size: number
  type: string
  lastModified: number
  path?: string
}

// 上传状态
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'

// 上传结果
export interface UploadResult {
  status: UploadStatus
  file: FileInfo
  url?: string
  error?: string
  progress?: number
}

// 配置项类型
export interface ConfigItem<T = any> {
  key: string
  value: T
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  required?: boolean
  defaultValue?: T
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    enum?: T[]
  }
}

// 事件类型
export interface EventData<T = any> {
  type: string
  payload: T
  timestamp: number
  source?: string
}

// 回调函数类型
export type Callback<T = void> = (data: T) => void
export type AsyncCallback<T = void> = (data: T) => Promise<void>

// 错误处理函数类型
export type ErrorHandler = (error: Error) => void

// 清理函数类型
export type CleanupFunction = () => void

// 工具函数类型
export type Predicate<T> = (item: T) => boolean
export type Mapper<T, U> = (item: T) => U
export type Reducer<T, U> = (acc: U, item: T) => U

// 深度可选类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// 深度只读类型
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

// 提取数组元素类型
export type ArrayElement<T> = T extends (infer U)[] ? U : never

// 提取Promise返回类型
export type PromiseType<T> = T extends Promise<infer U> ? U : never

// 函数参数类型
export type Parameters<T> = T extends (...args: infer P) => any ? P : never

// 函数返回类型
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any
