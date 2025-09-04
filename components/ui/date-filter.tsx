"use client"

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Search, Info } from 'lucide-react'

interface DateFilterProps {
  onFilterChange: (enabled: boolean) => void
  enabled: boolean
  dataCount: number
  filteredCount: number
  // 可选的搜索功能
  searchValue?: string
  onSearchChange?: (value: string) => void
  showSearch?: boolean
  searchPlaceholder?: string
}

export function DateFilter({ 
  onFilterChange, 
  enabled, 
  dataCount, 
  filteredCount,
  searchValue,
  onSearchChange,
  showSearch = false,
  searchPlaceholder = "搜索代币..."
}: DateFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-3 bg-blue-50 rounded-lg border border-blue-100 min-h-[48px]">
      {/* 搜索框 - 最前面 */}
      {showSearch && onSearchChange && (
        <div className="relative w-full sm:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9 bg-white border-blue-200 focus:border-blue-400 shadow-sm"
          />
        </div>
      )}
      
      {/* 右侧区域：过滤器和统计 - 固定布局 */}
      <div className="flex items-center gap-6 flex-shrink-0">
        {/* 过滤器区域 - 固定宽度 */}
        <TooltipProvider>
          <div className="flex items-center gap-2" style={{width: '120px'}}>
            <Checkbox 
              id="date-filter"
              checked={enabled}
              onCheckedChange={onFilterChange}
              className="flex-shrink-0"
            />
            <label 
              htmlFor="date-filter" 
              className="flex items-center gap-1 text-sm font-medium text-gray-700 cursor-pointer flex-shrink-0"
            >
              <span>最近30天</span>
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {enabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-blue-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>显示最近30天内的空投数据</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="h-3 w-3" />
                )}
              </div>
            </label>
          </div>
        </TooltipProvider>
        
        {/* 统计区域 - 固定宽度 */}
        <div className="text-sm text-gray-600 flex-shrink-0" style={{width: '160px'}}>
          显示 <span className="font-medium text-blue-600">{filteredCount}</span> / {dataCount} 条记录
        </div>
      </div>
    </div>
  )
}
