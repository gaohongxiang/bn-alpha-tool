import React from 'react'
import { getTypeColorConfig, getTypeDisplayName } from '@/lib/core/type-colors'

interface TypeBadgeProps {
  type: string
  className?: string
}

export function TypeBadge({ type, className = '' }: TypeBadgeProps) {
  const config = getTypeColorConfig(type)

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.lightClassName} ${className}`}
    >
      {getTypeDisplayName(type)}
    </span>
  )
}
