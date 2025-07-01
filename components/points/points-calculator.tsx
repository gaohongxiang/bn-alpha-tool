"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { HelpCircle, Calculator } from "lucide-react"
import { PointsUtils } from "@/lib/utils/points-utils"

export function PointsCalculator() {
  // 状态管理
  const [balance, setBalance] = useState([1000])
  const [dailyTradingVolume, setDailyTradingVolume] = useState([32768])
  const [isBscChain, setIsBscChain] = useState(true)
  const [airdropThreshold, setAirdropThreshold] = useState([240])
  const [airdropValue, setAirdropValue] = useState([80])
  const [dailyWearValue, setDailyWearValue] = useState([5])

  // 编辑状态
  const [editingBalance, setEditingBalance] = useState(false)
  const [editingTradingVolume, setEditingTradingVolume] = useState(false)
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [editingAirdropValue, setEditingAirdropValue] = useState(false)
  const [editingWearValue, setEditingWearValue] = useState(false)

  // 临时值状态
  const [tempBalance, setTempBalance] = useState("")
  const [tempTradingVolume, setTempTradingVolume] = useState("")
  const [tempThreshold, setTempThreshold] = useState("")
  const [tempAirdropValue, setTempAirdropValue] = useState("")
  const [tempWearValue, setTempWearValue] = useState("")

  // 预设值
  const balancePresets = [100, 1000, 10000, 100000, 1000000]
  const tradingVolumePresets = [16384, 32768, 65536, 131072, 262144, 524288]
  const thresholdPresets = [50, 150, 250, 350, 500]
  const airdropValuePresets = [10, 50, 100, 200, 500]
  const wearValuePresets = [0, 5, 15, 30, 50]

  // 修正空投次数计算逻辑 - 每次固定消耗15分
  const calculateAirdropCount = (totalPoints: number, threshold: number) => {
    let remainingPoints = totalPoints
    let airdropCount = 0

    // 每次固定消耗15分
    const costPerClaim = 15

    while (remainingPoints >= threshold) {
      airdropCount++
      remainingPoints -= costPerClaim
    }

    return {
      airdropCount,
      remainingPoints: Math.max(0, remainingPoints),
    }
  }

  // 计算结果
  const calculations = useMemo(() => {
    const balancePoints = PointsUtils.balance(balance[0])
    const effectiveVolume = isBscChain ? dailyTradingVolume[0] * 2 : dailyTradingVolume[0]
    const tradingVolumePoints = PointsUtils.tradingVolume(effectiveVolume)
    const dailyTotalPoints = balancePoints + tradingVolumePoints
    const cycleTotalPoints = dailyTotalPoints * 15

    // 使用新的计算方法
    const { airdropCount: actualAirdrops, remainingPoints } = calculateAirdropCount(
      cycleTotalPoints,
      airdropThreshold[0],
    )

    const cycleAirdropIncome = actualAirdrops * airdropValue[0]
    const cycleWearCost = dailyWearValue[0] * 15
    const cycleNetIncome = cycleAirdropIncome - cycleWearCost

    const monthlyAirdropIncome = cycleAirdropIncome * 2
    const monthlyWearCost = cycleWearCost * 2
    const monthlyNetIncome = monthlyAirdropIncome - monthlyWearCost

    return {
      balancePoints,
      tradingVolumePoints,
      effectiveVolume,
      dailyTotalPoints,
      cycleTotalPoints,
      actualAirdrops,
      remainingPoints,
      cycleAirdropIncome,
      cycleWearCost,
      cycleNetIncome,
      monthlyAirdropIncome,
      monthlyWearCost,
      monthlyNetIncome,
    }
  }, [balance, dailyTradingVolume, isBscChain, airdropThreshold, airdropValue, dailyWearValue])

  // BSC链交易处理
  const handleBscChainChange = (checked: boolean | "indeterminate") => {
    if (typeof checked === "boolean") {
      setIsBscChain(checked)
    }
  }

  // 快速设置值
  const setQuickValue = (setter: (value: number[]) => void, value: number) => {
    setter([value])
  }

  // 数字格式化函数：1位小数，整数时不显示小数点
  const formatNumber = (num: number): string => {
    if (Number.isInteger(num)) {
      return num.toString()
    }
    return num.toFixed(1)
  }

  // 修改createSliderLogic函数，增加forceInteger参数
  const createSliderLogic = (presets: number[], forceInteger = false) => {
    return {
      valueToSliderPosition: (value: number): number => {
        if (forceInteger) value = Math.round(value)
        for (let i = 0; i < presets.length - 1; i++) {
          if (value >= presets[i] && value <= presets[i + 1]) {
            const ratio = (value - presets[i]) / (presets[i + 1] - presets[i])
            const segmentSize = 100 / (presets.length - 1)
            return i * segmentSize + ratio * segmentSize
          }
        }
        if (value < presets[0]) return 0
        if (value > presets[presets.length - 1]) {
          const lastSegmentLength = presets[presets.length - 1] - presets[presets.length - 2]
          const overshoot = value - presets[presets.length - 1]
          const extraRatio = overshoot / lastSegmentLength
          const segmentSize = 100 / (presets.length - 1)
          return Math.min(100, 100 - segmentSize + segmentSize * (1 + extraRatio))
        }
        return 0
      },
      sliderPositionToValue: (position: number) => {
        const index = (position / 100) * (presets.length - 1)
        const lowerIndex = Math.floor(index)
        const upperIndex = Math.ceil(index)
        if (lowerIndex === upperIndex) {
          return forceInteger ? Math.round(presets[lowerIndex]) : presets[lowerIndex]
        }
        const ratio = index - lowerIndex
        let value = presets[lowerIndex] + (presets[upperIndex] - presets[lowerIndex]) * ratio
        return forceInteger ? Math.round(value) : value
      }
    }
  }

  // 为每个参数创建滑动块逻辑
  const balanceSlider = createSliderLogic(balancePresets)
  const tradingVolumeSlider = createSliderLogic(tradingVolumePresets)
  // 门槛使用线性映射：50-500分，实现真正的1分步进
  const thresholdSlider = {
    valueToSliderPosition: (value: number) => ((value - 50) / (500 - 50)) * 100,
    sliderPositionToValue: (position: number) => Math.round(50 + (position / 100) * (500 - 50))
  }
  const airdropValueSlider = createSliderLogic(airdropValuePresets)
  // 每日磨损：使用预设值映射，整数步进
  const wearValueSlider = createSliderLogic(wearValuePresets, true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* 2x2 Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 基础参数设置 */}
                      <Card className="h-full shadow-xl border-0 bg-gradient-to-br from-orange-50 to-amber-50">
                          <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="w-5 h-5" />
                基础参数设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* 账户余额 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="font-normal">账户余额 (USDT)</Label>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-3">
                  {editingBalance ? (
                    <input
                      type="number"
                      value={tempBalance}
                      onChange={(e) => setTempBalance(e.target.value)}
                      onBlur={() => {
                        const value = Number(tempBalance)
                        if (!isNaN(value) && value >= 0) {
                          setBalance([value])
                        }
                        setEditingBalance(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = Number(tempBalance)
                          if (!isNaN(value) && value >= 0) {
                            setBalance([value])
                          }
                          setEditingBalance(false)
                        }
                      }}
                      className="text-2xl font-light bg-transparent border-b-2 border-blue-400 outline-none w-48"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setTempBalance(balance[0].toString())
                        setEditingBalance(true)
                      }}
                      className="text-2xl font-light hover:text-blue-600 cursor-pointer"
                    >
                      ${balance[0].toLocaleString()}
                    </button>
                  )}
                  <Slider
                    value={[balanceSlider.valueToSliderPosition(balance[0])]}
                    onValueChange={(values) => {
                      const newValue = balanceSlider.sliderPositionToValue(values[0])
                      setBalance([newValue])
                    }}
                    max={100}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500 font-light">
                    {balancePresets.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => setQuickValue(setBalance, preset)}
                        className={`hover:text-blue-500 cursor-pointer transition-colors ${
                          balance[0] === preset ? 'text-blue-500 font-light' : ''
                        }`}
                      >
                        {preset >= 1000000
                          ? `$${preset / 1000000}M`
                          : preset >= 1000
                            ? `$${preset / 1000}K`
                            : `$${preset}`}
                      </button>
                    ))}
                  </div>
                  <div className="text-sm text-green-600 font-light">余额积分: {calculations.balancePoints} 分/天</div>
                </div>
              </div>

              {/* 每日交易量 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="font-normal">每日交易量 (USDT)</Label>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-3">
                  {editingTradingVolume ? (
                    <input
                      type="number"
                      value={tempTradingVolume}
                      onChange={(e) => setTempTradingVolume(e.target.value)}
                      onBlur={() => {
                        const value = Number(tempTradingVolume)
                        if (!isNaN(value) && value >= 0) {
                          setDailyTradingVolume([value])
                        }
                        setEditingTradingVolume(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = Number(tempTradingVolume)
                          if (!isNaN(value) && value >= 0) {
                            setDailyTradingVolume([value])
                          }
                          setEditingTradingVolume(false)
                        }
                      }}
                      className="text-2xl font-medium bg-transparent border-b-2 border-blue-500 outline-none w-48"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setTempTradingVolume(dailyTradingVolume[0].toString())
                        setEditingTradingVolume(true)
                      }}
                      className="text-2xl font-light hover:text-blue-500 cursor-pointer"
                    >
                      ${dailyTradingVolume[0].toLocaleString()}
                    </button>
                  )}
                  <Slider
                    value={[tradingVolumeSlider.valueToSliderPosition(dailyTradingVolume[0])]}
                    onValueChange={(values) => {
                      const newValue = tradingVolumeSlider.sliderPositionToValue(values[0])
                      setDailyTradingVolume([newValue])
                    }}
                    max={100}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500 font-light">
                    {tradingVolumePresets.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => setQuickValue(setDailyTradingVolume, preset)}
                        className={`hover:text-blue-600 cursor-pointer transition-colors ${
                          dailyTradingVolume[0] === preset ? 'text-blue-600 font-medium' : ''
                        }`}
                      >
                        ${preset / 1000}K
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="bsc-chain" checked={isBscChain} onCheckedChange={handleBscChainChange} />
                    <Label htmlFor="bsc-chain" className="font-light">
                      BSC链交易 (交易量翻倍)
                    </Label>
                  </div>
                  <div className="text-sm text-green-600 font-light">
                    {isBscChain && <div>实际计算交易量: ${calculations.effectiveVolume.toLocaleString()}</div>}
                    交易量积分: {calculations.tradingVolumePoints} 分/天
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 空投参数设置 */}
                      <Card className="h-full shadow-xl border-0 bg-gradient-to-br from-orange-50 to-amber-50">
                          <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="w-5 h-5" />
                空投参数设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* 空投门槛 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="font-normal">空投积分门槛</Label>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-3">
                  {editingThreshold ? (
                    <input
                      type="number"
                      value={tempThreshold}
                      onChange={(e) => setTempThreshold(e.target.value)}
                      onBlur={() => {
                        const value = Number(tempThreshold)
                        if (!isNaN(value) && value >= 50) {
                          setAirdropThreshold([Math.round(value)])
                        }
                        setEditingThreshold(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = Number(tempThreshold)
                          if (!isNaN(value) && value >= 50) {
                            setAirdropThreshold([Math.round(value)])
                          }
                          setEditingThreshold(false)
                        }
                      }}
                      step={1}
                      className="text-2xl font-light bg-transparent border-b-2 border-blue-400 outline-none w-32"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setTempThreshold(airdropThreshold[0].toString())
                        setEditingThreshold(true)
                      }}
                      className="text-2xl font-light hover:text-blue-500 cursor-pointer"
                    >
                      {airdropThreshold[0]} 分
                    </button>
                  )}
                  <Slider
                    value={[thresholdSlider.valueToSliderPosition(airdropThreshold[0])]}
                    onValueChange={(values) => {
                      const newValue = thresholdSlider.sliderPositionToValue(values[0])
                      setAirdropThreshold([Math.round(newValue)])
                    }}
                    max={100}
                    min={0}
                    step={0.22}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500 font-light">
                    {thresholdPresets.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => setQuickValue(setAirdropThreshold, preset)}
                        className={`hover:text-blue-500 cursor-pointer transition-colors ${
                          airdropThreshold[0] === preset ? 'text-blue-500 font-light' : ''
                        }`}
                      >
                        {preset}分
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 空投价值 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="font-light">单次空投价值 (USDT)</Label>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-3">
                  {editingAirdropValue ? (
                    <input
                      type="number"
                      value={tempAirdropValue}
                      onChange={(e) => setTempAirdropValue(e.target.value)}
                      onBlur={() => {
                        const value = Number(tempAirdropValue)
                        if (!isNaN(value) && value >= 10) {
                          setAirdropValue([Math.round(value)])
                        }
                        setEditingAirdropValue(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = Number(tempAirdropValue)
                          if (!isNaN(value) && value >= 10) {
                            setAirdropValue([Math.round(value)])
                          }
                          setEditingAirdropValue(false)
                        }
                      }}
                      className="text-2xl font-medium bg-transparent border-b-2 border-blue-500 outline-none w-32"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setTempAirdropValue(airdropValue[0].toString())
                        setEditingAirdropValue(true)
                      }}
                      className="text-2xl font-light hover:text-blue-500 cursor-pointer"
                    >
                      ${airdropValue[0]}
                    </button>
                  )}
                  <Slider
                    value={[airdropValueSlider.valueToSliderPosition(airdropValue[0])]}
                    onValueChange={(values) => {
                      const newValue = airdropValueSlider.sliderPositionToValue(values[0])
                      setAirdropValue([Math.round(newValue)])
                    }}
                    max={100}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500 font-light">
                    {airdropValuePresets.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => setQuickValue(setAirdropValue, preset)}
                        className={`hover:text-blue-500 cursor-pointer transition-colors ${
                          airdropValue[0] === preset ? 'text-blue-500 font-light' : ''
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 每日磨损 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="font-light">每日磨损成本 (USDT)</Label>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-3">
                  {editingWearValue ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tempWearValue}
                      onChange={(e) => {
                        // 处理全角半角小数点，并去除空格
                        const val = e.target.value
                          .replace(/．/g, '.') // 全角转半角
                          .replace(/。/g, '.') // 句号转半角
                          .replace(/\s/g, '')  // 去除所有空格
                        setTempWearValue(val)
                      }}
                      onFocus={(e) => {
                        // 将光标移到末尾，方便追加输入
                        setTimeout(() => {
                          e.target.setSelectionRange(e.target.value.length, e.target.value.length)
                        }, 0)
                      }}
                      onBlur={() => {
                        const value = Number(tempWearValue)
                        if (!isNaN(value) && value >= 0) {
                          // 限制到1位小数
                          const rounded = Math.round(value * 10) / 10
                          setDailyWearValue([rounded])
                        }
                        setEditingWearValue(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const value = Number(tempWearValue)
                          if (!isNaN(value) && value >= 0) {
                            // 限制到1位小数
                            const rounded = Math.round(value * 10) / 10
                            setDailyWearValue([rounded])
                          }
                          setEditingWearValue(false)
                        }
                      }}
                      className="text-2xl font-medium bg-transparent border-b-2 border-blue-500 outline-none w-32"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setTempWearValue(dailyWearValue[0].toString())
                        setEditingWearValue(true)
                      }}
                      className="text-2xl font-light hover:text-blue-500 cursor-pointer"
                    >
                      ${dailyWearValue[0]}
                    </button>
                  )}
                  <Slider
                    value={[wearValueSlider.valueToSliderPosition(dailyWearValue[0])]}
                    onValueChange={(values) => {
                      const newValue = wearValueSlider.sliderPositionToValue(values[0])
                      setDailyWearValue([Math.round(newValue)])
                    }}
                    max={100}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500 font-light">
                    {wearValuePresets.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => setQuickValue(setDailyWearValue, preset)}
                        className={`hover:text-blue-500 cursor-pointer transition-colors ${
                          dailyWearValue[0] === preset ? 'text-blue-500 font-light' : ''
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 积分计算 */}
                      <Card className="h-full shadow-xl border-0 bg-gradient-to-br from-orange-50 to-amber-50">
                          <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="w-5 h-5" />
                积分计算
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 font-extralight">每日总积分</p>
                  <p className="text-2xl font-light text-blue-500">{calculations.dailyTotalPoints} 分</p>
                  <p className="text-xs text-gray-400 font-extralight">
                    余额 {calculations.balancePoints} + 交易量 {calculations.tradingVolumePoints}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 font-extralight">15天周期总分</p>
                  <p className="text-2xl font-light text-green-500">{calculations.cycleTotalPoints} 分</p>
                  <p className="text-xs text-gray-400 font-extralight">{calculations.dailyTotalPoints} × 15天</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-light mb-3">空投领取分析</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 font-light">可领取空投次数</span>
                    <span className="font-light text-lg">{calculations.actualAirdrops} 次</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 font-light">剩余积分</span>
                    <span className="font-light text-orange-500">{calculations.remainingPoints} 分</span>
                  </div>
                   <div className="text-xs text-gray-400 font-light mt-2">
                      计算逻辑: 每次检查剩余积分≥{airdropThreshold[0]}分时可领取，每次固定消耗15分
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 收益计算 */}
                      <Card className="h-full shadow-xl border-0 bg-gradient-to-br from-orange-50 to-amber-50">
                          <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-lg py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="w-5 h-5" />
                收益计算
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="bg-gradient-to-r from-yellow-50 to-purple-50 p-4 rounded-lg border">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="text-xs text-gray-500 font-extralight">项目</div>
                  <div className="text-xs text-yellow-700 font-light">15天周期</div>
                  <div className="text-xs text-purple-700 font-light">30天月度</div>
                  
                  <div className="text-sm text-gray-600 font-light">空投收入</div>
                  <div className="font-light text-green-600">+${formatNumber(calculations.cycleAirdropIncome)}</div>
                  <div className="font-light text-green-600">+${formatNumber(calculations.monthlyAirdropIncome)}</div>
                  
                  <div className="text-sm text-gray-600 font-light">磨损成本</div>
                  <div className="font-light text-red-500">-${formatNumber(calculations.cycleWearCost)}</div>
                  <div className="font-light text-red-500">-${formatNumber(calculations.monthlyWearCost)}</div>
                  
                  <div className="text-sm font-medium text-gray-700 border-t pt-2">净收益</div>
                  <div className={`font-medium text-lg border-t pt-2 ${calculations.cycleNetIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${formatNumber(calculations.cycleNetIncome)}
                  </div>
                  <div className={`font-medium text-xl border-t pt-2 ${calculations.monthlyNetIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${formatNumber(calculations.monthlyNetIncome)}
                  </div>
                </div>
              </div>

              {calculations.monthlyNetIncome > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600">✓</span>
                    <span className="font-medium text-green-800">盈利策略</span>
                  </div>
                  <p className="text-sm text-green-700 font-light">
                    当前参数配置下，月度净收益为正，建议执行此策略。
                  </p>
                </div>
              )}

              {calculations.monthlyNetIncome <= 0 && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-600">⚠</span>
                    <span className="font-medium text-red-800">亏损警告</span>
                  </div>
                  <p className="text-sm text-red-700 font-light">
                    当前参数配置下，月度净收益为负，建议调整策略参数。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
