/**
 * Winston 专业日志系统
 *
 * 特性：
 * - 自动终端输出捕获
 * - 按日期轮转日志文件
 * - 多级别日志 (error, warn, info, debug, verbose)
 * - 客户端/服务端自适应
 * - 异步高性能写入
 * - 自动清理过期日志
 */

// 主要日志器和类型
export {
  logger,
  WinstonLogger,
  type LogLevel
} from './winston-logger'

// React Hooks
export {
  useLogger,
  useLoggerSession,
  useCategoryLogger
} from './winston-hooks'

// 导入 logger 用于默认导出
import { logger } from './winston-logger'

// 默认导出
export default logger
