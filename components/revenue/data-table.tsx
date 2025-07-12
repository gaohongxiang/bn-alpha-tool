"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, RefreshCw, Copy, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { WalletData } from "@/types"

interface DataTableProps {
  walletData: WalletData[]
  onViewTransactions?: (address: string) => void
  onRetryWallet?: (address: string) => void
  isQuerying?: boolean
}

export function DataTable({ walletData, onViewTransactions, onRetryWallet, isQuerying = false }: DataTableProps) {
  const [sortBy, setSortBy] = useState("default")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState("table")
  
  // 复制成功提示状态
  const [copyToast, setCopyToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
    position: { x: number; y: number };
  }>({ show: false, message: '', type: 'success', position: { x: 0, y: 0 } })

  // 复制到剪贴板功能
  const copyToClipboard = async (text: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopyToast({
        show: true,
        message: '地址已复制',
        type: 'success',
        position
      })
    } catch (err) {
      setCopyToast({
        show: true,
        message: '复制失败',
        type: 'error',
        position
      })
    }

    setTimeout(() => {
      setCopyToast(prev => ({ ...prev, show: false }))
    }, 2000)
  }

  // 排序逻辑
  const handleSort = (sortType: string) => {
    if (sortBy === sortType) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortBy(sortType)
      setSortDirection("desc")
    }
  }

  // 截断地址
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // 格式化数字
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  }

  // 搜索过滤
  const filteredData = walletData.filter(wallet => 
    wallet.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wallet.note?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 排序数据
  const getSortedData = () => {
    if (sortBy === "default") return filteredData

    return [...filteredData].sort((a, b) => {
      let aVal: number, bVal: number

      switch (sortBy) {
        case "balance":
          aVal = a.totalBalance || 0
          bVal = b.totalBalance || 0
          break
        case "volume":
          aVal = a.tradingVolume || 0
          bVal = b.tradingVolume || 0
          break
        case "points":
          aVal = a.estimatedPoints || 0
          bVal = b.estimatedPoints || 0
          break
        case "transactions":
          aVal = a.transactionCount || 0
          bVal = b.transactionCount || 0
          break
        case "revenue":
          aVal = (a.revenue || 0) + (a.gasUsed || 0)
          bVal = (b.revenue || 0) + (b.gasUsed || 0)
          break
        case "tradingLoss":
          aVal = a.tradingLoss || a.revenue || 0
          bVal = b.tradingLoss || b.revenue || 0
          break
        case "gasLoss":
          aVal = a.gasLoss || a.gasUsed || 0
          bVal = b.gasLoss || b.gasUsed || 0
          break
        default:
          return 0
      }

      if (sortDirection === "asc") {
        return aVal - bVal
      } else {
        return bVal - aVal
      }
    })
  }

  // 计算总计
  const totalStats = {
    totalBalance: filteredData.reduce((sum, w) => sum + (w.totalBalance || 0), 0),
    totalVolume: filteredData.reduce((sum, w) => sum + (w.tradingVolume || 0), 0),
    totalPoints: filteredData.reduce((sum, w) => sum + (w.estimatedPoints || 0), 0),
    totalTransactions: filteredData.reduce((sum, w) => sum + (w.transactionCount || 0), 0),
    totalRevenue: filteredData.reduce((sum, w) => sum + (w.tradingLoss || w.revenue || 0), 0),
    totalGas: filteredData.reduce((sum, w) => sum + (w.gasLoss || w.gasUsed || 0), 0),
  }

  // 获取排序图标
  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3" />
    return sortDirection === "asc" ? 
      <ArrowUp className="w-3 h-3" /> : 
      <ArrowDown className="w-3 h-3" />
  }

  const sortedData = getSortedData()

  // 如果正在查询，显示加载状态
  if (isQuerying) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>查询结果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-green-500" />
              <h3 className="text-xl font-medium text-gray-700">正在查询钱包数据...</h3>
              <p className="text-gray-500">
                正在分析钱包的交易数据，请稍候
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (walletData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>查询结果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>暂无数据</p>
            <p className="text-sm mt-1">请先添加钱包并进行查询</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>链上数据统计</span>
            <div className="flex items-center gap-4">
              {/* 搜索 */}
              <Input
                placeholder="搜索钱包地址或备注"
                className="w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              {/* 排序选择 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">排序:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="默认排序" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">默认排序</SelectItem>
                    <SelectItem value="balance">余额</SelectItem>
                    <SelectItem value="volume">交易额</SelectItem>
                    <SelectItem value="points">积分</SelectItem>
                    <SelectItem value="revenue">总磨损</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 视图切换 */}
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="rounded-none"
                >
                  表格
                </Button>
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="rounded-none"
                >
                  卡片
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 总计统计 */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-gray-600">总余额</div>
                <div className="font-semibold text-green-600">${formatNumber(totalStats.totalBalance)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">总交易量</div>
                <div className="font-semibold text-blue-600">${formatNumber(totalStats.totalVolume)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">总积分</div>
                <div className="font-semibold text-purple-600">{totalStats.totalPoints}分</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">有效交易</div>
                <div className="font-semibold">{totalStats.totalTransactions}次</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">交易磨损</div>
                <div className="font-semibold text-red-600">${formatNumber(totalStats.totalRevenue)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Gas磨损</div>
                <div className="font-semibold text-orange-600">${formatNumber(totalStats.totalGas)}</div>
              </div>
            </div>

            {/* 数据表格/卡片 */}
            {viewMode === "table" ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>钱包地址</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("balance")}
                          className="h-8 p-1"
                        >
                          余额(USDT) {getSortIcon("balance")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("volume")}
                          className="h-8 p-1"
                        >
                          交易额 {getSortIcon("volume")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("transactions")}
                          className="h-8 p-1"
                        >
                          有效交易 {getSortIcon("transactions")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("points")}
                          className="h-8 p-1"
                        >
                          预估积分 {getSortIcon("points")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("revenue")}
                          className="h-8 p-1"
                        >
                          磨损明细 {getSortIcon("revenue")}
                        </Button>
                      </TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((wallet) => (
                      <TableRow key={wallet.address} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{truncateAddress(wallet.address)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => copyToClipboard(wallet.address, e)}
                              title="复制完整地址"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{wallet.note}</TableCell>
                        <TableCell>
                          <div className="text-right">
                            <div className="text-green-600 font-medium">${formatNumber(wallet.totalBalance || 0)}</div>
                            <div className="text-xs text-gray-500">
                              {wallet.tokenBalances?.length || 0} 代币
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right">
                            <div className="text-blue-600 font-medium">${formatNumber(wallet.tradingVolume || 0)}</div>
                            <Badge variant="outline" className="text-xs">
                              BSC 2x
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right font-medium">{wallet.transactionCount || 0}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right">
                            <Badge variant={(wallet.estimatedPoints || 0) > 0 ? "default" : "secondary"} className="text-purple-600">
                              {wallet.estimatedPoints || 0}分
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right">
                            <div className="text-red-600 font-medium">
                              ${formatNumber((wallet.tradingLoss || wallet.revenue || 0) + (wallet.gasLoss || wallet.gasUsed || 0))}
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <div>交易: ${formatNumber(wallet.tradingLoss || wallet.revenue || 0)}</div>
                              <div>Gas: ${formatNumber(wallet.gasLoss || wallet.gasUsed || 0)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {wallet.error ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive" className="text-xs">
                                  查询失败
                                </Badge>
                                {onRetryWallet && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onRetryWallet(wallet.address)}
                                    title="重试查询"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              onViewTransactions && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onViewTransactions(wallet.address)}
                                  title="查看交易详情"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              // 卡片视图
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedData.map((wallet) => (
                  <Card key={wallet.address} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{truncateAddress(wallet.address)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => copyToClipboard(wallet.address, e)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <Badge variant="outline">{wallet.note}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-gray-600">余额</div>
                            <div className="font-medium text-green-600">${formatNumber(wallet.totalBalance || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">交易额</div>
                            <div className="font-medium text-blue-600">${formatNumber(wallet.tradingVolume || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">积分</div>
                            <div className="font-medium text-purple-600">{wallet.estimatedPoints || 0}分</div>
                          </div>
                          <div>
                            <div className="text-gray-600">磨损</div>
                            <div className="font-medium text-red-600">
                              ${formatNumber((wallet.tradingLoss || wallet.revenue || 0) + (wallet.gasLoss || wallet.gasUsed || 0))}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                          <div className="text-xs text-gray-500">
                            {wallet.transactionCount || 0} 次有效交易
                          </div>
                          <div className="flex gap-1">
                            {wallet.error ? (
                              <Badge variant="destructive" className="text-xs">失败</Badge>
                            ) : (
                              onViewTransactions && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onViewTransactions(wallet.address)}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 错误统计 */}
            {walletData.some(w => w.error) && (
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">
                  ⚠️ {walletData.filter(w => w.error).length} 个钱包查询失败，可点击重试按钮重新查询
                </p>
              </div>
            )}

            {/* 搜索结果提示 */}
            {searchQuery && filteredData.length !== walletData.length && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  🔍 搜索到 {filteredData.length} 个钱包（共 {walletData.length} 个）
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 复制成功提示 */}
      {copyToast.show && (
        <div 
          className={`fixed z-[9999] px-3 py-2 rounded-md shadow-lg text-white text-sm font-medium transition-all duration-300 pointer-events-none ${
            copyToast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
          style={{
            left: `${copyToast.position.x}px`,
            top: `${copyToast.position.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {copyToast.message}
        </div>
      )}
    </>
  )
} 