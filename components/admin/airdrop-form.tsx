"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { X, Save, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { validateAirdropData, sanitizeAirdropData } from '@/lib/features/airdrop/validation'
import type { AirdropItem } from '@/types/airdrop'
import type { ValidationError } from '@/lib/features/airdrop/validation'

interface AirdropFormProps {
  item?: AirdropItem | null
  onSubmit: (data: Partial<AirdropItem>) => Promise<void>
  onCancel: () => void
}

export function AirdropForm({ item, onSubmit, onCancel }: AirdropFormProps) {
  const isEditing = !!item
  const { toast } = useToast()

  // 表单数据
  const [formData, setFormData] = useState<Partial<AirdropItem>>({
    date: '',
    token: '',
    amount: undefined,
    supplementaryToken: undefined,
    type: 'alpha',
    currentPrice: '',
    points: undefined,
    phase1Points: undefined,
    phase2Points: undefined,
    startTime: '',
    endTime: '',
    phase1EndTime: '',
    phase2EndTime: '',
    participants: undefined,
    cost: undefined,
    pointsConsumed: true,
    description: ''
  })

  // 表单模式状态
  const [airdropMode, setAirdropMode] = useState<'single' | 'phase'>('single')

  // 验证状态
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 日期格式转换：从 "YYYY年MM月DD日" 转换为 "YYYY-MM-DD"
  const convertDateForInput = (dateStr: string): string => {
    if (!dateStr) return ''

    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }

    // 转换 "YYYY年MM月DD日" 格式为 "YYYY-MM-DD"
    const match = dateStr.match(/(\d{4})年(\d{2})月(\d{2})日/)
    if (match) {
      const [, year, month, day] = match
      return `${year}-${month}-${day}`
    }

    return dateStr
  }

  // 价格格式转换：从 "$0.07" 转换为 "0.07"
  const convertPriceForInput = (priceStr: string): string => {
    if (!priceStr) return ''

    // 如果已经是纯数字格式，直接返回
    if (/^\d+(\.\d+)?$/.test(priceStr)) {
      return priceStr
    }

    // 移除 $ 符号和其他非数字字符，但保留小数点
    const cleanPrice = priceStr.replace(/[^0-9.]/g, '')
    return cleanPrice
  }

  // 初始化表单数据
  useEffect(() => {
    if (item) {
      setFormData({
        date: convertDateForInput(item.date || ''),
        token: item.token || '',
        amount: item.amount || undefined,
        supplementaryToken: item.supplementaryToken || undefined,
        type: item.type || 'alpha',
        currentPrice: convertPriceForInput(item.currentPrice || ''),
        points: item.points || undefined,
        phase1Points: item.phase1Points || undefined,
        phase2Points: item.phase2Points || undefined,
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        phase1EndTime: item.phase1EndTime || '',
        phase2EndTime: item.phase2EndTime || '',
        participants: item.participants || undefined,
        cost: item.cost || undefined,
        pointsConsumed: item.pointsConsumed ?? true,
        description: item.description || ''
      })

      // 设置模式：根据是否有两阶段数据判断
      const hasPhasePoints = (item.phase1Points && item.phase1Points > 0) || (item.phase2Points && item.phase2Points > 0)
      const hasPhaseTime = item.phase1EndTime || item.phase2EndTime
      setAirdropMode((hasPhasePoints || hasPhaseTime) ? 'phase' : 'single')
    }
  }, [item])



  // 更新表单字段
  const updateField = (field: keyof AirdropItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // 清除相关字段的错误
    setErrors(prev => prev.filter(error => error.field !== field))
  }

  // 切换空投模式
  const toggleAirdropMode = (mode: 'single' | 'phase') => {
    setAirdropMode(mode)
    if (mode === 'single') {
      // 切换到单阶段：清除两阶段数据
      setFormData(prev => ({
        ...prev,
        phase1Points: undefined,
        phase2Points: undefined,
        phase1EndTime: '',
        phase2EndTime: ''
      }))
    } else {
      // 切换到两阶段：清除单阶段数据
      setFormData(prev => ({
        ...prev,
        points: undefined,
        endTime: ''
      }))
    }
  }

  // 获取字段错误信息
  const getFieldError = (field: string) => {
    return errors.find(error => error.field === field)?.message
  }

  // 表单验证
  const validateForm = () => {
    const sanitized = sanitizeAirdropData(formData)
    const validation = validateAirdropData(sanitized)
    setErrors(validation.errors)
    return validation.isValid
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      // 验证失败时不显示 toast，只显示字段错误
      return
    }

    setIsSubmitting(true)
    try {
      const sanitized = sanitizeAirdropData(formData)
      await onSubmit(sanitized)

      // 直接关闭表单，让父组件处理成功状态
      onCancel()
    } catch (error) {
      console.error('提交失败:', error)

      // 只在网络错误等异常情况下显示 toast
      toast({
        variant: "destructive",
        title: "操作失败",
        description: error instanceof Error ? error.message : "提交失败，请重试",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {isEditing ? `编辑空投 - ${item?.token}` : '新增空投'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基础信息 */}
            <div className="space-y-4">
              {/* 第一行：空投日期、代币名称、空投类型 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">空投日期 *</Label>
                  <div className="relative">
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateField('date', e.target.value)}
                      className={`pr-10 cursor-pointer ${getFieldError('date') ? 'border-red-500' : ''} ${!formData.date ? 'text-muted-foreground/60' : ''} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100`}
                      style={{
                        colorScheme: 'light'
                      }}
                    />
                  </div>
                  {getFieldError('date') && (
                    <div className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError('date')}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token">代币名称 *</Label>
                  <Input
                    id="token"
                    value={formData.token}
                    onChange={(e) => updateField('token', e.target.value.toUpperCase())}
                    placeholder="FIR"
                    className={`${getFieldError('token') ? 'border-red-500' : ''} ${!formData.token ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                  />
                  {getFieldError('token') && (
                    <div className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError('token')}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">空投类型</Label>

                  <Select
                    value={formData.type || 'alpha'}
                    onValueChange={(value) => {
                      if (value && (value === 'alpha' || value === 'tge' || value === 'pre-tge')) {
                        updateField('type', value);
                      }
                    }}
                  >
                    <SelectTrigger className={getFieldError('type') ? 'border-red-500' : ''}>
                      <SelectValue placeholder="选择空投类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alpha">Alpha</SelectItem>
                      <SelectItem value="tge">TGE</SelectItem>
                      <SelectItem value="preTge">Pre-TGE</SelectItem>
                    </SelectContent>
                  </Select>
                  {getFieldError('type') && (
                    <div className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError('type')}
                    </div>
                  )}
                </div>
              </div>

              {/* 第二行：空投数量、当前价格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">空投数量</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount || ''}
                    onChange={(e) => updateField('amount', parseFloat(e.target.value) || undefined)}
                    placeholder="1000"
                    className={`${getFieldError('amount') ? 'border-red-500' : ''} ${!formData.amount ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                  />
                  {getFieldError('amount') && (
                    <div className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError('amount')}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentPrice">当前价格</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="currentPrice"
                      type="number"
                      step="0.001"
                      value={formData.currentPrice || ''}
                      onChange={(e) => updateField('currentPrice', e.target.value)}
                      placeholder="0.07"
                      className={`pl-8 ${getFieldError('currentPrice') ? 'border-red-500' : ''} ${!formData.currentPrice ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                    />
                  </div>
                  {getFieldError('currentPrice') && (
                    <div className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError('currentPrice')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 空投模式设置 */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Label className="text-base font-semibold">空投模式</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={airdropMode === 'single' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleAirdropMode('single')}
                  >
                    单阶段
                  </Button>
                  <Button
                    type="button"
                    variant={airdropMode === 'phase' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleAirdropMode('phase')}
                  >
                    两阶段
                  </Button>
                </div>
              </div>

              {/* 开始时间（共用字段） */}
              <div className="space-y-2">
                <Label htmlFor="startTime">开始时间</Label>
                <Input
                  id="startTime"
                  value={formData.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  placeholder="2025-06-19 20:00 (UTC+8) 或 2025-06-19"
                  className={`${getFieldError('startTime') ? 'border-red-500' : ''} ${!formData.startTime ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                />
                {getFieldError('startTime') && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('startTime')}
                  </div>
                )}
              </div>
            </div>

            {airdropMode === 'single' ? (
              <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2 text-blue-700 font-medium mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  单阶段空投配置
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="points">积分门槛</Label>
                    <Input
                      id="points"
                      type="number"
                      value={formData.points || ''}
                      onChange={(e) => updateField('points', parseInt(e.target.value) || undefined)}
                      placeholder="200"
                      className={`${getFieldError('points') ? 'border-red-500' : ''} ${!formData.points ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                    />
                    {getFieldError('points') && (
                      <div className="text-red-500 text-sm flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {getFieldError('points')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endTime">结束时间</Label>
                    <Input
                      id="endTime"
                      value={formData.endTime}
                      onChange={(e) => updateField('endTime', e.target.value)}
                      placeholder="2025-06-20 20:00 (UTC+8)"
                      className={`${getFieldError('endTime') ? 'border-red-500' : ''} ${!formData.endTime ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                    />
                    {getFieldError('endTime') && (
                      <div className="text-red-500 text-sm flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {getFieldError('endTime')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-6 space-y-6">
                <div className="flex items-center gap-2 text-purple-700 font-medium">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  两阶段空投配置
                </div>

                {/* 积分配置 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">积分门槛设置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phase1Points">优先获取积分</Label>
                      <Input
                        id="phase1Points"
                        type="number"
                        value={formData.phase1Points || ''}
                        onChange={(e) => updateField('phase1Points', parseInt(e.target.value) || undefined)}
                        placeholder="200"
                        className={`${getFieldError('phase1Points') ? 'border-red-500' : ''} ${!formData.phase1Points ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                      />
                      {getFieldError('phase1Points') && (
                        <div className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {getFieldError('phase1Points')}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phase2Points">先到先得积分</Label>
                      <Input
                        id="phase2Points"
                        type="number"
                        value={formData.phase2Points || ''}
                        onChange={(e) => updateField('phase2Points', parseInt(e.target.value) || undefined)}
                        placeholder="400"
                        className={`${getFieldError('phase2Points') ? 'border-red-500' : ''} ${!formData.phase2Points ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                      />
                      {getFieldError('phase2Points') && (
                        <div className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {getFieldError('phase2Points')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 时间配置 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">阶段结束时间</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phase1EndTime">优先获取结束时间</Label>
                      <Input
                        id="phase1EndTime"
                        value={formData.phase1EndTime}
                        onChange={(e) => updateField('phase1EndTime', e.target.value)}
                        placeholder="2025-06-19 22:00 (UTC+8)"
                        className={`${getFieldError('phase1EndTime') ? 'border-red-500' : ''} ${!formData.phase1EndTime ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                      />
                      {getFieldError('phase1EndTime') && (
                        <div className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {getFieldError('phase1EndTime')}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phase2EndTime">先到先得结束时间</Label>
                      <Input
                        id="phase2EndTime"
                        value={formData.phase2EndTime}
                        onChange={(e) => updateField('phase2EndTime', e.target.value)}
                        placeholder="2025-06-20 20:00 (UTC+8)"
                        className={`${getFieldError('phase2EndTime') ? 'border-red-500' : ''} ${!formData.phase2EndTime ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                      />
                      {getFieldError('phase2EndTime') && (
                        <div className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {getFieldError('phase2EndTime')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 最后一行：成本、参与人数、补发数量 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">成本 (TGE/Pre-TGE项目)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost || ''}
                  onChange={(e) => updateField('cost', parseFloat(e.target.value) || undefined)}
                  placeholder="100"
                  className={`${getFieldError('cost') ? 'border-red-500' : ''} ${!formData.cost ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                />
                {getFieldError('cost') && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('cost')}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="participants">参与人数</Label>
                <Input
                  id="participants"
                  type="number"
                  value={formData.participants || ''}
                  onChange={(e) => updateField('participants', parseInt(e.target.value) || undefined)}
                  placeholder="1000"
                  className={`${getFieldError('participants') ? 'border-red-500' : ''} ${!formData.participants ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                />
                {getFieldError('participants') && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('participants')}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplementaryToken">补发数量</Label>
                <Input
                  id="supplementaryToken"
                  type="number"
                  step="0.01"
                  value={formData.supplementaryToken || ''}
                  onChange={(e) => updateField('supplementaryToken', parseFloat(e.target.value) || undefined)}
                  placeholder="500"
                  className={`${getFieldError('supplementaryToken') ? 'border-red-500' : ''} ${!formData.supplementaryToken ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}`}
                />
                {getFieldError('supplementaryToken') && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError('supplementaryToken')}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pointsConsumed"
                  checked={formData.pointsConsumed}
                  onCheckedChange={(checked) => updateField('pointsConsumed', checked)}
                />
                <Label htmlFor="pointsConsumed">消耗积分</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述信息</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="空投相关的描述信息..."
                rows={3}
                className={!formData.description ? 'text-muted-foreground/60 placeholder:text-muted-foreground/40' : ''}
              />
            </div>



            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {isEditing ? '更新中...' : '创建中...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    {isEditing ? '更新' : '创建'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
