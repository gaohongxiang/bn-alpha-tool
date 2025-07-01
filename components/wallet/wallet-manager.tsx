"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Edit2, Plus, Check, X, Copy, Save, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { Wallet } from "@/types"

interface WalletManagerProps {
  wallets: Wallet[]
  onWalletsChange: (wallets: Wallet[]) => void
}

export function WalletManager({ wallets, onWalletsChange }: WalletManagerProps) {
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [walletInput, setWalletInput] = useState("")
  const [editingWallet, setEditingWallet] = useState<string | null>(null)
  const [editingAddress, setEditingAddress] = useState("")
  const [editingNote, setEditingNote] = useState("")
  const [selectedWallets, setSelectedWallets] = useState<string[]>([])
  
  // 复制成功提示状态
  const [copyToast, setCopyToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
    position: { x: number; y: number };
  }>({ show: false, message: '', type: 'success', position: { x: 0, y: 0 } })

  // 验证钱包地址格式
  const validateAddress = (address: string): boolean => {
    // 以太坊地址格式：0x开头，42位16进制字符
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

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

  // 截断地址显示
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // 批量导入钱包
  const handleImportWallets = () => {
    const lines = walletInput.trim().split('\n').filter(line => line.trim())
    const newWallets: Wallet[] = []
    let validCount = 0
    let duplicateCount = 0
    let invalidCount = 0

    lines.forEach(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return

      let address: string
      let note: string

      if (trimmedLine.includes(',')) {
        const parts = trimmedLine.split(',')
        address = parts[0].trim()
        note = parts.slice(1).join(',').trim()
      } else {
        address = trimmedLine
        note = `钱包${wallets.length + newWallets.length + 1}`
      }

      if (!validateAddress(address)) {
        invalidCount++
        return
      }

      const isDuplicate = wallets.some(w => w.address.toLowerCase() === address.toLowerCase()) ||
                         newWallets.some(w => w.address.toLowerCase() === address.toLowerCase())

      if (isDuplicate) {
        duplicateCount++
        return
      }

      newWallets.push({ address, note: note || `钱包${wallets.length + newWallets.length + 1}` })
      validCount++
    })

    if (newWallets.length > 0) {
      onWalletsChange([...wallets, ...newWallets])
    }

    let message = `导入完成！成功: ${validCount}`
    if (duplicateCount > 0) message += `, 重复: ${duplicateCount}`
    if (invalidCount > 0) message += `, 无效: ${invalidCount}`
    alert(message)

    setWalletInput("")
    setWalletModalOpen(false)
  }

  // 删除钱包
  const handleRemoveWallet = (address: string) => {
    if (confirm("确定要删除这个钱包吗？")) {
      onWalletsChange(wallets.filter(w => w.address !== address))
      setSelectedWallets(selectedWallets.filter(addr => addr !== address))
    }
  }

  // 编辑钱包
  const handleEditWallet = (wallet: Wallet) => {
    setEditingWallet(wallet.address)
    setEditingAddress(wallet.address)
    setEditingNote(wallet.note)
  }

  // 保存编辑
  const handleSaveEdit = () => {
    if (!validateAddress(editingAddress)) {
      alert("钱包地址格式不正确")
      return
    }

    const existingWallet = wallets.find(w => 
      w.address.toLowerCase() === editingAddress.toLowerCase() && 
      w.address !== editingWallet
    )
    
    if (existingWallet) {
      alert("该地址已被其他钱包使用")
      return
    }

    onWalletsChange(wallets.map(w => 
      w.address === editingWallet 
        ? { address: editingAddress, note: editingNote || `钱包${wallets.length}` }
        : w
    ))

    setEditingWallet(null)
    setEditingAddress("")
    setEditingNote("")
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingWallet(null)
    setEditingAddress("")
    setEditingNote("")
  }

  // 选择钱包
  const handleSelectWallet = (address: string, checked: boolean) => {
    if (checked) {
      setSelectedWallets([...selectedWallets, address])
    } else {
      setSelectedWallets(selectedWallets.filter(addr => addr !== address))
    }
  }

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWallets(wallets.map(w => w.address))
    } else {
      setSelectedWallets([])
    }
  }

  // 批量删除
  const handleBatchDelete = () => {
    if (confirm(`确定要删除选中的 ${selectedWallets.length} 个钱包吗？`)) {
      onWalletsChange(wallets.filter(w => !selectedWallets.includes(w.address)))
      setSelectedWallets([])
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>钱包管理</CardTitle>
          <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                钱包管理
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>钱包管理</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* 批量导入区域 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">批量导入钱包</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    每行一个钱包地址，格式：地址,备注名称（备注可选）
                  </p>
                  <Textarea
                    className="min-h-[120px] font-mono text-sm"
                    placeholder="0x1234567890123456789012345678901234567890&#10;0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,钱包1&#10;0x9876543210987654321098765432109876543210,Wallet2"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                  />
                  <Button
                    className="w-full mt-2"
                    onClick={handleImportWallets}
                    disabled={!walletInput.trim()}
                  >
                    批量导入
                  </Button>
                </div>

                {/* 钱包列表 */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">已添加的钱包 ({wallets.length})</h4>
                    {selectedWallets.length > 0 && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleBatchDelete}
                      >
                        删除选中 ({selectedWallets.length})
                      </Button>
                    )}
                  </div>

                  {wallets.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="w-12 p-3">
                              <input
                                type="checkbox"
                                checked={selectedWallets.length === wallets.length && wallets.length > 0}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="rounded"
                              />
                            </th>
                            <th className="text-left p-3 font-medium">钱包地址</th>
                            <th className="text-left p-3 font-medium">备注</th>
                            <th className="w-20 p-3 font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wallets.map((wallet) => (
                            <tr key={wallet.address} className="border-t hover:bg-gray-50">
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={selectedWallets.includes(wallet.address)}
                                  onChange={(e) => handleSelectWallet(wallet.address, e.target.checked)}
                                  className="rounded"
                                />
                              </td>
                              <td className="p-3">
                                {editingWallet === wallet.address ? (
                                  <Input
                                    value={editingAddress}
                                    onChange={(e) => setEditingAddress(e.target.value)}
                                    className="font-mono text-sm"
                                  />
                                ) : (
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
                                )}
                              </td>
                              <td className="p-3">
                                {editingWallet === wallet.address ? (
                                  <Input
                                    value={editingNote}
                                    onChange={(e) => setEditingNote(e.target.value)}
                                    className="text-sm"
                                  />
                                ) : (
                                  <span className="text-sm">{wallet.note}</span>
                                )}
                              </td>
                              <td className="p-3">
                                {editingWallet === wallet.address ? (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-green-600"
                                      onClick={handleSaveEdit}
                                    >
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-gray-600"
                                      onClick={handleCancelEdit}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-blue-600"
                                      onClick={() => handleEditWallet(wallet)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-red-600"
                                      onClick={() => handleRemoveWallet(wallet.address)}
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>暂无钱包地址</p>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {wallets.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>还没有添加钱包地址</p>
              <p className="text-sm mt-1">点击"钱包管理"开始添加</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wallets.slice(0, 3).map((wallet) => (
                <div key={wallet.address} className="flex items-center gap-2 p-2 border rounded text-sm">
                  <span className="font-mono">{truncateAddress(wallet.address)}</span>
                  <span className="text-gray-500">{wallet.note}</span>
                </div>
              ))}
              {wallets.length > 3 && (
                <div className="text-center text-sm text-gray-500">
                  ...还有 {wallets.length - 3} 个钱包
                </div>
              )}
              <div className="pt-2 border-t">
                <Badge variant="outline">
                  总计: {wallets.length} 个钱包
                </Badge>
              </div>
            </div>
          )}
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