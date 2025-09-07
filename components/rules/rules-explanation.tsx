import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Calculator, Star, AlertTriangle, Info, Award, DollarSign, Zap, Clock, BookOpen } from "lucide-react"

export function RulesExplanation() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-8">
          
          {/* Alpha Points 基础介绍 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-200 shadow-lg">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-blue-500 p-3 rounded-xl">
                <Info className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-blue-900">什么是 Alpha Points？</h2>
                <p className="text-blue-700">了解积分系统的核心概念</p>
              </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-blue-200">
              <p className="text-gray-700 leading-relaxed text-lg">
                币安 Alpha 积分是一个综合评估系统，用于衡量用户在币安 Alpha 和币安钱包生态内的活跃度。
                通过持有资产和交易活动获得积分，从而获得参与代币生成活动 (TGE) 和 Alpha 代币空投的资格。
              </p>
              
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="font-semibold text-blue-800 mb-2">📈 日常计算</div>
                  <div className="text-sm text-blue-700">每日根据资产余额和交易量计算</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                  <div className="font-semibold text-indigo-800 mb-2">🔄 15日累计</div>
                  <div className="text-sm text-indigo-700">积分为过去15天的累计总和</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="font-semibold text-purple-800 mb-2">🎯 空投资格</div>
                  <div className="text-sm text-purple-700">积分决定空投参与资格</div>
                </div>
              </div>
            </div>
          </div>

                      {/* 资产积分规则 */}
                      <Card className="shadow-xl border-0 bg-gradient-to-br from-rose-50 to-pink-50">
                          <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-400 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5" />
                资产积分规则
                <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                  余额计算
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="bg-white p-6 rounded-xl border border-green-200 shadow-sm">
                  <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                    📊 合格资产范围
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-green-700 mb-2">✅ 中心化交易所</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• 已上币安现货的代币</li>
                        <li>• Alpha 账户中的资产</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-700 mb-2">✅ 币安钱包</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• Alpha 代币</li>
                        <li>• 已上币安现货的代币</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-700">
                      ❌ <strong>不合格资产：</strong>未在Alpha区展示、未在币安现货交易的代币（如LSD代币）
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-green-200">
                <div className="bg-green-500 text-white p-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    积分对照表
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-green-800">资产余额 (USDT)</th>
                        <th className="text-left py-4 px-6 font-semibold text-green-800">每日积分</th>
                        <th className="text-left py-4 px-6 font-semibold text-green-800">15日累计</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-green-50 transition-colors">
                        <td className="py-4 px-6 font-medium">$100 - $999</td>
                        <td className="py-4 px-6">
                          <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
                            1积分
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-gray-600">15积分</td>
                      </tr>
                      <tr className="border-b hover:bg-green-50 transition-colors">
                        <td className="py-4 px-6 font-medium">$1,000 - $9,999</td>
                        <td className="py-4 px-6">
                          <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
                            2积分
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-gray-600">30积分</td>
                      </tr>
                      <tr className="border-b hover:bg-green-50 transition-colors">
                        <td className="py-4 px-6 font-medium">$10,000 - $99,999</td>
                        <td className="py-4 px-6">
                          <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
                            3积分
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-gray-600">45积分</td>
                      </tr>
                      <tr className="hover:bg-green-50 transition-colors">
                        <td className="py-4 px-6 font-medium">$100,000以上</td>
                        <td className="py-4 px-6">
                          <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
                            4积分
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-gray-600">60积分</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 交易量积分规则 */}
                      <Card className="shadow-xl border-0 bg-gradient-to-br from-rose-50 to-pink-50">
                          <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-400 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5" />
                交易量积分规则
                <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                  购买计算
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="bg-white p-6 rounded-xl border border-purple-200 shadow-sm">
                  <h3 className="font-bold text-purple-800 mb-4">🔢 计算公式</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-700 mb-2">基础规则</h4>
                      <ul className="text-sm space-y-1">
                        <li>• 首 $2 获得 1 分</li>
                        <li>• 之后每翻倍增加 1 分</li>
                        <li>• $4 = 2分，$8 = 3分</li>
                      </ul>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-orange-700 mb-2 flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        Alpha 窗口加成
                      </h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>BSC(30天内) 4×</strong>、<strong>其他链(30天内) 2×</strong>、<strong>非alpha活动代币或30天外 1×</strong></li>
                        <li>• 示例：$32（BSC）→ 按 $128 计算；$32（其他链）→ 按 $64 计算；$32（非alpha活动代币或30天外）→ 按 $32 计算</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-purple-200">
                <div className="bg-purple-500 text-white p-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    交易量积分对照表
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-purple-50">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-purple-800">每日Alpha代币交易量</th>
                        <th className="text-left py-4 px-6 font-semibold text-purple-800">每日积分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { range: '$2 / 4 / 8 / 16 / 32 / 64', points: '1 / 2 / 3 / 4 / 5 / 6' },
                        { range: '$128 / 256 / 512', points: '7 / 8 / 9' },
                        { range: '$1024 / 2048', points: '10 / 11' },
                        { range: '$4096', points: '12' },
                        { range: '$8192', points: '13' },
                        { range: '$16384', points: '14' },
                        { range: '$32768', points: '15' },
                        { range: '$65536', points: '16' },
                      ].map((row, index) => (
                        <tr key={index} className="border-b hover:bg-purple-50 transition-colors">
                          <td className="py-3 px-6 font-medium">{row.range}</td>
                          <td className="py-3 px-6">
                            <Badge variant="outline" className="bg-purple-100 border-purple-300 text-purple-800">
                              {row.points} 积分
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      <tr className="hover:bg-purple-50 transition-colors">
                        <td className="py-4 px-6 font-medium">以此类推...</td>
                        <td className="py-4 px-6 text-gray-600">每翻倍+1积分</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 积分计算示例 */}
                      <Card className="shadow-xl border-0 bg-gradient-to-br from-rose-50 to-pink-50">
                          <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-400 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="w-5 h-5" />
                积分计算示例
                <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                  实战案例
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* 普通交易示例 */}
                <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <Calculator className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-indigo-800">普通交易示例</h3>
                  </div>
                  
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 mb-4">
                    <p className="font-medium text-indigo-800 mb-3">
                      💼 场景：持有$5,000资产，购买$32的Alpha代币
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-sm">余额积分</span>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-800">2分</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        <span className="text-sm">交易量积分</span>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">5分</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-indigo-100 rounded-lg border border-indigo-300">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold">当日总积分</span>
                      </div>
                      <Badge className="bg-indigo-600 text-white">7分</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-blue-100 rounded-lg border border-blue-300">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold">15日累计</span>
                      </div>
                      <Badge className="bg-blue-600 text-white">105分</Badge>
                    </div>
                  </div>
                </div>

                {/* BSC链交易示例 */}
                <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-orange-100 p-2 rounded-lg">
                      <Zap className="w-5 h-5 text-orange-600" />
                    </div>
                    <h3 className="font-bold text-orange-800">BSC链交易示例</h3>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-4">
                    <p className="font-medium text-orange-800 mb-3">
                      ⚡ 场景：持有$5,000资产，BSC链购买$32的Alpha代币
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-sm">余额积分</span>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-800">2分</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-orange-500" />
                        <span className="text-sm">窗口加成（BSC 4×）</span>
                      </div>
                      <span className="text-sm text-orange-700">$32 → $128</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        <span className="text-sm">交易量积分</span>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">7分</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-orange-100 rounded-lg border border-orange-300">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-orange-600" />
                        <span className="font-semibold">当日总积分</span>
                      </div>
                      <Badge className="bg-orange-600 text-white">9分</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-orange-200 rounded-lg border border-orange-400">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-orange-700" />
                        <span className="font-semibold">15日累计</span>
                      </div>
                      <Badge className="bg-orange-700 text-white">135分</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 注意事项 */}
                      <Card className="shadow-xl border-0 bg-gradient-to-br from-rose-50 to-pink-50">
                          <CardHeader className="bg-gradient-to-r from-rose-500 to-pink-400 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="w-5 h-5" />
                重要注意事项
                <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                  必读
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="bg-orange-100 p-3 rounded-xl flex-shrink-0">
                      <Info className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-orange-800 mb-3 text-lg">积分重置</h4>
                      <p className="text-gray-700 leading-relaxed">Alpha 积分每日重置计算，需要每天保持交易活跃度才能获得积分</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-xl flex-shrink-0">
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-800 mb-3 text-lg">快照时间</h4>
                      <p className="text-gray-700 leading-relaxed">资产快照时间为每日 UTC+8 08:00，建议在此时间前完成交易及资产调整</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* 底部信息 */}
        <div className="mt-12 text-center">
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 shadow-lg">
            <p className="text-gray-600 mb-2">
              💡 本规则说明基于币安官方文档整理，具体规则以币安官方最新公告为准
            </p>
            <p className="text-sm text-gray-500">
              更新时间：2024年6月 | 数据仅供参考，投资需谨慎
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
