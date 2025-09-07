"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle } from "lucide-react"

interface RulesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RulesModal({ open, onOpenChange }: RulesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">交易统计规则说明</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 总体说明 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
            <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-3">
              📋 总体说明
            </h3>
            <div className="text-gray-700 space-y-2">
              <p>• <strong>时间范围：</strong>每天从早上8:00到第二天早上8:00算1天（UTC+8北京时间）</p>
              <p>• <strong>统计目标：</strong>分析BSC链上的钱包余额、有效交易和磨损情况</p>
              <p>• <strong>积分计算：</strong>余额积分 + 交易积分（Alpha窗口：BSC 4×，其他 2×；非窗口 1×）</p>
            </div>
          </div>

          {/* 余额统计规则 */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
            <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-3">
              📊 当天余额统计
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <h4 className="font-semibold text-blue-700 mb-2">📈 统计范围</h4>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>USDT余额</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>BNB余额</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                    <span className="text-gray-500">其他代币（不统计）</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <h4 className="font-semibold text-blue-700 mb-2">⏰ 计算时点</h4>
                <div className="text-sm space-y-1">
                  <div>当天结束时的余额</div>
                  <div>当前查询时间的余额</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                <h4 className="font-semibold text-blue-700 mb-2">🎯 使用场景</h4>
                <div className="text-sm space-y-1">
                  <div>• 积分计算的余额部分</div>
                  <div>• 钱包资产概览显示</div>
                </div>
              </div>
            </div>
          </div>

          {/* 有效交易规则 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
            <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-3">
              📈 有效交易识别规则
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                  ✅ 计算交易量的交易对
                </h4>
                <div className="space-y-2">
                  <div className="bg-white px-4 py-2 rounded-lg border-l-4 border-green-400 shadow-sm">
                    <span className="font-medium text-green-800">USDT → ZKJ</span>
                    <span className="text-sm text-gray-600 ml-2">买入ZKJ</span>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-lg border-l-4 border-green-400 shadow-sm">
                    <span className="font-medium text-green-800">USDT → KOGE</span>
                    <span className="text-sm text-gray-600 ml-2">买入KOGE</span>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-lg border-l-4 border-green-400 shadow-sm">
                    <span className="font-medium text-green-800">ZKJ ↔ KOGE</span>
                    <span className="text-sm text-gray-600 ml-2">代币互换</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
                  ⚠️ 不计算交易量的交易
                </h4>
                <div className="space-y-2">
                  <div className="bg-orange-50 px-4 py-2 rounded-lg border-l-4 border-orange-400">
                    <span className="font-medium text-orange-800">ZKJ → USDT</span>
                    <span className="text-sm text-gray-600 ml-2">卖出ZKJ（仅计算Gas）</span>
                  </div>
                  <div className="bg-orange-50 px-4 py-2 rounded-lg border-l-4 border-orange-400">
                    <span className="font-medium text-orange-800">KOGE → USDT</span>
                    <span className="text-sm text-gray-600 ml-2">卖出KOGE（仅计算Gas）</span>
                  </div>
                  <div className="bg-red-50 px-4 py-2 rounded-lg border-l-4 border-red-400">
                    <span className="font-medium text-red-800">纯转账</span>
                    <span className="text-sm text-gray-600 ml-2">USDT转入/转出（影响磨损计算）</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
              <p className="text-gray-700 text-sm">
                💡 <strong>统计方式：</strong>每笔符合条件的交易计为1次有效交易，以USDT价值统计交易额。BSC链交易额会在积分计算时翻倍。
              </p>
            </div>
          </div>

          {/* 积分计算规则 */}
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200">
            <h3 className="text-xl font-bold text-purple-800 mb-4 flex items-center gap-3">
              🏆 积分计算体系
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                <h4 className="font-semibold text-purple-700 mb-3">💰 余额积分</h4>
                <div className="space-y-2 text-sm">
                  <div>• 统计范围：仅USDT + BNB余额</div>
                  <div>• 计算时点：当天截止时间的余额</div>
                  <div>• 积分公式：根据总USD价值对照积分表</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                <h4 className="font-semibold text-purple-700 mb-3">📊 交易量积分</h4>
                <div className="space-y-2 text-sm">
                  <div>• 基础交易额：实际USDT交易量</div>
                  <div>• <span className="font-semibold text-orange-600">Alpha窗口加成</span>：BSC ×4，其他链 ×2；非窗口 ×1</div>
                  <div>• 判定：代币 Alpha（空投/TGE）开始后 30 天内买入的交易</div>
                  <div>• 积分转换：按加成后的有效交易量换算积分</div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔢</span>
                <strong className="text-purple-800">计算示例</strong>
              </div>
              <p className="text-gray-700 text-sm">
                某钱包在BSC链实际交易额$20,000，加成后为$40,000，对照积分表获得15积分。
                余额为$5,000（USDT+BNB），对照积分表获得3积分。总积分：15 + 3 = 18分。
              </p>
            </div>
          </div>

          {/* 磨损计算规则 */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 rounded-xl border border-red-200">
            <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-3">
              💸 磨损计算机制
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                <h4 className="font-semibold text-red-700 mb-3">🔄 交易磨损</h4>
                <div className="space-y-2 text-sm">
                  <div>📍 统计所有指定币对交易的买入和卖出</div>
                  <div>📍 计算买入价值与卖出价值的差额</div>
                  <div>📍 按交易时的USDT价格计算</div>
                  <div className="font-semibold text-red-600">💰 磨损 = 买入价值 - 卖出价值</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                <h4 className="font-semibold text-orange-700 mb-3">⛽ Gas费磨损</h4>
                <div className="space-y-2 text-sm">
                  <div>📍 统计当天所有指定币对的交易的Gas消耗</div>
                  <div>📍 按实时BNB价格转换为USDT</div>
                  <div className="font-semibold text-orange-600">⛽ Gas费 = 总Gas消耗 × BNB价格</div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📊</span>
                <strong className="text-red-800">计算示例</strong>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong className="text-red-700">交易磨损示例：</strong><br />
                  买入：1000 USDT买ZKJ<br />
                  卖出：950 USDT卖ZKJ<br />
                  <span className="font-semibold text-red-600">交易磨损 = 50 USDT</span>
                </div>
                <div>
                  <strong className="text-orange-700">Gas磨损示例：</strong><br />
                  Gas消耗：0.002 BNB<br />
                  BNB价格：$600<br />
                  <span className="font-semibold text-orange-600">Gas磨损 = 1.2 USDT</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-sm text-gray-500">
            💡 规则会根据平台政策更新，请关注最新版本
          </div>
          <Button onClick={() => onOpenChange(false)} className="bg-blue-600 hover:bg-blue-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            我已了解
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 