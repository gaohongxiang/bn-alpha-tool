"use client"

import type { AirdropHistoryItem } from "@/types/airdrop"

interface HistoryTableProps {
    airdropHistoryData: AirdropHistoryItem[]
}

export function HistoryTable({ airdropHistoryData }: HistoryTableProps) {
    return (
        <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <span className="font-medium">💡 提示：</span>
                两阶段空投数据会在积分门槛列显示"优先获取"和"先到先得"两个门槛，历史曲线以优先获取阶段为准展示趋势。
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b">
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
                        {[...airdropHistoryData].reverse().map((item, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4 font-light text-center">{item.date}</td>
                                <td className="py-3 px-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="text-blue-600 font-normal">{item.token}</span>
                                        {/* 免费领取标注 */}
                                        {!(item.pointsConsumed ?? true) && (
                                            <div className="text-xs text-green-600 font-medium">🎁 免费领取</div>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-center">
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
                                <td className="py-3 px-4 text-center">
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
                                <td className="py-3 px-4 font-light text-center">{item.currentPrice}</td>
                                <td className="py-3 px-4 text-green-600 font-normal text-center">${item.revenue.toFixed(2)}</td>
                                <td className="py-3 px-4 text-center">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${item.type === "alpha" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                                            }`}
                                    >
                                        {item.type}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
} 