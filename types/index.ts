/**
 * 统一类型导出
 * 提供项目中所有类型的统一访问入口
 *
 * 使用方式：
 * import type { WalletData, APIResponse, RevenueDisplayProps } from '@/types'
 *
 * 类型分类：
 * - 核心业务类型：API、钱包、交易、配置等
 * - UI组件类型：组件Props、响应数据等
 * - 业务逻辑类型：批量查询、系统配置等
 * - 通用工具类型：分页、排序、状态等
 */

// ==================== 核心业务类型 ====================

// API 相关类型
export type {
  APIKey,
  APIHealth,
  APIRequest,
  APIResponse,
  EnhancedAPIResponse,
  RateLimitConfig,
  NetworkAPI,
  BSCScanResponse,
  BSCScanTransaction,
  APIError,
  RateLimitError
} from './api'

// 钱包相关类型
export type {
  Wallet,
  TokenBalance,
  WalletData,
  BalanceQueryResult
} from './wallet'

// 交易相关类型
export type {
  RawTransaction,
  ExchangeTransaction,
  TradingLoss,
  GasLoss,
  ValidTransactions,
  AllExchanges,
  TradingLossResult,
  BlockRange,
  TradingPairAnalysisResult
} from './transaction'

// 配置相关类型
export type {
  TokenConfig,
  TradingPairConfig,
  TradingRules,
  APIConfig,
  NetworkConfig,
  AppConfig,
  AirdropData
} from './config'

// 时间相关类型
export type {
  DayTimeRange,
} from './time'

// 空投相关类型
export * from './airdrop'

// ==================== UI组件类型 ====================

// UI组件Props类型
export type {
  RevenueDisplayProps,
  AnalyzeResponse,
  ExportDataRequest,
  ExportDataResponse,
  SaveLogRequest,
  SaveLogResponse,
  DataTableProps,
  QueryControlsProps,
  ModalProps,
  TransactionModalProps,
  RulesModalProps
} from './ui'

// ==================== 业务逻辑类型 ====================

// 业务逻辑相关类型
export type {
  BatchQueryConfig,
  WalletQueryParams,
  APIKeyStats,
  APIKeyInfo,
  QueueItem,
  HealthCheckConfig,
  CacheConfig,
  EnhancedCacheConfig,
  APIResponseMetadata,
  MonitoringConfig,
  CircuitBreakerConfig,
  APISystemConfig,
  RequestFunction,
  TransactionSummary,
  PointsCalculationResult,
  BlockRangeResult
} from './business'

// ==================== 通用工具类型 ====================

// 通用类型
export type {
  LoadingState,
  SortOrder,
  NetworkStatus,
  OperationResult,
  PaginationParams,
  PaginatedResult,
  TimeRange,
  KeyValuePair,
  Option,
  FormField,
  Filter,
  SearchParams,
  Environment,
  LogLevel,
  Theme,
  Language,
  Currency,
  FileInfo,
  UploadStatus,
  UploadResult,
  ConfigItem,
  EventData,
  Callback,
  AsyncCallback,
  ErrorHandler,
  CleanupFunction,
  Predicate,
  Mapper,
  Reducer,
  DeepPartial,
  DeepReadonly,
  ArrayElement,
  PromiseType
} from './common'