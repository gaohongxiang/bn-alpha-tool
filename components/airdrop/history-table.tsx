"use client"

import { useState, useMemo, useCallback } from 'react'
import type { AirdropHistoryItem } from "@/types/airdrop"
import { TypeBadge } from "@/components/ui/type-badge"
import { DateFilter } from "@/components/ui/date-filter"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { filterAirdropsByDate, getFilterStats, type DateFilterType } from "@/lib/features/airdrop/date-filter"

interface HistoryTableProps {
    airdropHistoryData: AirdropHistoryItem[]
}

export function HistoryTable({ airdropHistoryData }: HistoryTableProps) {
    const [dateFilter, setDateFilter] = useState<DateFilterType>(false)
    const [searchTerm, setSearchTerm] = useState('')

    // 使用useCallback优化事件处理函数
    const handleDateFilterChange = useCallback((enabled: boolean) => {
        setDateFilter(enabled)
    }, [])

    // 应用日期过滤
    const dateFilteredData = useMemo(() => {
        return filterAirdropsByDate(airdropHistoryData, dateFilter)
    }, [airdropHistoryData, dateFilter])

    // 应用搜索过滤
    const filteredData = useMemo(() => {
        if (!searchTerm) return dateFilteredData
        
        return dateFilteredData.filter(item => 
            item.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.date.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [dateFilteredData, searchTerm])

    // 获取过滤统计信息
    const filterStats = useMemo(() => {
        return getFilterStats(airdropHistoryData, dateFilteredData, dateFilter)
    }, [airdropHistoryData, dateFilteredData, dateFilter])

    return (
        <div className="space-y-4 w-full">
            {/* 日期过滤器和搜索 */}
            <DateFilter
                onFilterChange={handleDateFilterChange}
                enabled={dateFilter}
                dataCount={airdropHistoryData.length}
                filteredCount={filteredData.length}
                showSearch={true}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="搜索代币名称或日期..."
            />

            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <span className="font-medium">💡 提示：</span>
                两阶段空投数据会在积分门槛列显示"优先获取"和"先到先得"两个门槛，历史曲线以优先获取阶段为准展示趋势。
            </div>
            <div className="w-full min-h-[400px] relative">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse transition-all duration-200" style={{tableLayout: 'fixed', minWidth: '800px'}}>
                        <colgroup>
                            <col style={{width: '140px'}} />
                            <col style={{width: '100px'}} />
                            <col style={{width: '120px'}} />
                            <col style={{width: '100px'}} />
                            <col style={{width: '120px'}} />
                            <col style={{width: '100px'}} />
                            <col style={{width: '120px'}} />
                        </colgroup>
                        <thead>
                            <tr className="border-b bg-gray-50">
                                <th className="text-center py-3 px-4 font-medium">空投日期</th>
                                <th className="text-center py-3 px-4 font-medium">代币名称</th>
                                <th className="text-center py-3 px-4 font-medium">积分门槛</th>
                                <th className="text-center py-3 px-4 font-medium">数量</th>
                                <th className="text-center py-3 px-4 font-medium">当天代币价格</th>
                                <th className="text-center py-3 px-4 font-medium">单号收益</th>
                                <th className="text-center py-3 px-4 font-medium">类型</th>
                            </tr>
                        </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center p-8 text-gray-500">
                                    {searchTerm ? (
                                        <div>
                                            <div>没有找到包含 "{searchTerm}" 的数据</div>
                                            <div className="text-xs text-gray-400 mt-1">请尝试其他关键词</div>
                                        </div>
                                    ) : !dateFilter ? (
                                        '暂无历史数据' 
                                    ) : (
                                        `在最近30天内没有找到空投数据`
                                    )}
                                </td>
                            </tr>
                        ) : (
                            [...filteredData].reverse().map((item, index) => (
                            <tr key={`${item.token}-${item.date}-${index}`} className="border-b hover:bg-gray-50 transition-colors duration-150">
                                <td className="py-3 px-4 font-light text-center overflow-hidden">{item.date}</td>
                                <td className="py-3 px-4 text-center overflow-hidden">
                                    <div className="flex flex-col items-center">
                                        <span className="text-blue-600 font-normal">{item.token}</span>
                                        {/* 免费领取标注 */}
                                        {!(item.pointsConsumed ?? true) && (
                                            <div className="text-xs text-green-600 font-medium">🎁 免费领取</div>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-center overflow-hidden">
                                    <div className="flex flex-col items-center space-y-1">
                                        {/* 积分门槛 - 第一行 */}
                                        <div>
                                            {item.phase1Points ? (
                                                <div className="flex items-center justify-center space-x-1">
                                                    <span className="text-blue-600 font-light">{item.phase1Points}</span>
                                                    <span className="text-gray-400">/</span>
                                                    <span className="text-orange-600 font-light">{item.phase2Points || 0}</span>
                                                    <span className="text-gray-600 font-light text-sm">分</span>
                                                </div>
                                            ) : (
                                                <span className="text-blue-600 font-light">{item.points} 分</span>
                                            )}
                                        </div>
                                        {/* 参与人数 - 第二行 */}
                                        {item.participants && (
                                            <div className="text-xs text-gray-500">
                                                {item.participants.toLocaleString()}人
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-center overflow-hidden">
                                    <div className="flex flex-col items-center space-y-1">
                                        {/* 主要数量 - 第一行 */}
                                        <div>
                                            <span className="text-blue-600 font-light">
                                                {(typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount).toLocaleString()}
                                            </span>
                                        </div>
                                        {/* 补发代币数量 - 第二行，只有大于0时才显示 */}
                                        {(() => {
                                            const supplementaryValue = typeof item.supplementaryToken === 'string'
                                                ? parseFloat(item.supplementaryToken)
                                                : item.supplementaryToken;
                                            return supplementaryValue > 0 && (
                                                <div className="text-xs text-orange-600">
                                                    +{supplementaryValue}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </td>
                                <td className="py-3 px-4 font-light text-center overflow-hidden">{item.currentPrice}</td>
                                <td className="py-3 px-4 text-green-600 font-normal text-center overflow-hidden">${item.revenue.toFixed(2)}</td>
                                <td className="py-3 px-4 text-center overflow-hidden">
                                    <TypeBadge type={item.type} />
                                </td>
                            </tr>
                            ))
                        )}
                    </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
} 