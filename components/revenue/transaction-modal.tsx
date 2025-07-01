"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExternalLink, Loader2 } from "lucide-react"

interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  tokenSymbol: string
  tokenName: string
  gasUsed: string
  gasPrice: string
  blockNumber: number
  timestamp: number
  usdValue: number
  fromToken?: string
  toToken?: string
  fromAmount?: number
  toAmount?: number
}

interface TransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletAddress: string
  selectedDate: string
  transactions: Transaction[]
  isLoading: boolean
}

export function TransactionModal({
  open,
  onOpenChange,
  walletAddress,
  selectedDate,
  transactions,
  isLoading
}: TransactionModalProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            有效交易详情 - {truncateAddress(walletAddress)} ({selectedDate})
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            <span>加载交易数据中...</span>
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              共找到 {transactions.length} 笔有效交易（按交易时USDT价值统计，最新交易在前）
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>交易哈希</TableHead>
                    <TableHead>交易对</TableHead>
                    <TableHead>交易数量</TableHead>
                    <TableHead>USDT价值</TableHead>
                    <TableHead>从</TableHead>
                    <TableHead>到</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions
                    .sort((a, b) => b.timestamp - a.timestamp) // 按时间戳降序排列（最新的在前）
                    .map((tx, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell>
                          <span className="font-mono text-sm">{truncateAddress(tx.hash)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium text-blue-600">
                            {tx.tokenSymbol}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tx.fromToken && tx.toToken ? (
                            <div className="text-sm">
                              <div>
                                {tx.fromAmount?.toFixed(4)} {tx.fromToken}
                              </div>
                              <div className="text-gray-500">↓</div>
                              <div>
                                {tx.toAmount?.toFixed(4)} {tx.toToken}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm">{tx.value}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">${formatNumber(tx.usdValue)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{truncateAddress(tx.from)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{truncateAddress(tx.to)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(tx.timestamp * 1000).toLocaleString("zh-CN")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://bscscan.com/tx/${tx.hash}`, "_blank")}
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            {/* 交易统计信息 */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">交易统计</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-blue-600">总交易量</div>
                  <div className="font-medium">
                    ${formatNumber(transactions.reduce((sum, tx) => sum + tx.usdValue, 0))}
                  </div>
                </div>
                <div>
                  <div className="text-blue-600">平均交易额</div>
                  <div className="font-medium">
                    ${formatNumber(transactions.reduce((sum, tx) => sum + tx.usdValue, 0) / transactions.length)}
                  </div>
                </div>
                <div>
                  <div className="text-blue-600">交易次数</div>
                  <div className="font-medium">{transactions.length} 次</div>
                </div>
                <div>
                  <div className="text-blue-600">BSC积分加成</div>
                  <div className="font-medium text-orange-600">2倍</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>该日期没有找到有效交易记录</p>
            <p className="text-sm mt-1">
              有效交易包括：USDT→ZKJ/KOGE、ZKJ↔KOGE 等交易对
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 