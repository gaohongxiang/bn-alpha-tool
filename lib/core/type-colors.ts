// 统一的空投类型颜色配置
export interface TypeColorConfig {
  className: string
  lightClassName: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
}

export const TYPE_COLOR_CONFIG: Record<string, TypeColorConfig> = {
  airdrop: {
    className: 'border-transparent !bg-blue-500 !text-white hover:!bg-blue-600',
    lightClassName: 'bg-blue-100 text-blue-800',
    variant: 'outline'
  },
  tge: {
    className: 'border-transparent !bg-purple-500 !text-white hover:!bg-purple-600',
    lightClassName: 'bg-purple-100 text-purple-800',
    variant: 'outline'
  },
  preTge: {
    className: 'border-transparent !bg-pink-500 !text-white hover:!bg-pink-600',
    lightClassName: 'bg-pink-100 text-pink-800',
    variant: 'outline'
  },
  bondingCurveTge: {
    className: 'border-transparent !bg-orange-500 !text-white hover:!bg-orange-600',
    lightClassName: 'bg-orange-100 text-orange-800',
    variant: 'outline'
  }
}

// 获取类型颜色配置
export function getTypeColorConfig(type: string): TypeColorConfig {
  return TYPE_COLOR_CONFIG[type] || {
    className: 'border-transparent !bg-gray-500 !text-white hover:!bg-gray-600',
    lightClassName: 'bg-gray-100 text-gray-800',
    variant: 'outline'
  }
}

// 获取类型显示名称
export function getTypeDisplayName(type: string): string {
  const displayNames: Record<string, string> = {
    airdrop: 'airdrop',
    tge: 'tge',
    preTge: 'preTge',
    bondingCurveTge: 'bondingCurveTge'
  }
  
  return displayNames[type] || type.toUpperCase()
}
