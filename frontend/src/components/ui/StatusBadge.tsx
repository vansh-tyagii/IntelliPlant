import React from 'react'
import type { RiskLevel } from '@/types/api'

interface StatusBadgeProps {
  level: RiskLevel | string
  pulse?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'bg-[rgba(239,68,68,0.15)]', text: 'text-[#ef4444]', border: 'border-[#ef4444]', dot: 'bg-[#ef4444]' },
  warning:  { bg: 'bg-[rgba(245,158,11,0.15)]', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  high:     { bg: 'bg-[rgba(245,158,11,0.15)]', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  normal:   { bg: 'bg-[rgba(34,197,94,0.15)]',  text: 'text-[#22c55e]', border: 'border-[#22c55e]',  dot: 'bg-[#22c55e]' },
  healthy:  { bg: 'bg-[rgba(34,197,94,0.15)]',  text: 'text-[#22c55e]', border: 'border-[#22c55e]',  dot: 'bg-[#22c55e]' },
  unknown:  { bg: 'bg-[rgba(100,116,139,0.15)]', text: 'text-[#64748b]', border: 'border-[#424656]', dot: 'bg-[#64748b]' },
}

const SIZE = { sm: 'text-[9px] px-1.5 py-0.5', md: 'text-[10px] px-2 py-0.5', lg: 'text-xs px-3 py-1' }

export const StatusBadge: React.FC<StatusBadgeProps> = ({ level, pulse, size = 'md' }) => {
  const cfg = CONFIG[String(level).toLowerCase()] || CONFIG.unknown
  return (
    <span className={`inline-flex items-center gap-1 rounded border font-mono font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border} ${SIZE[size]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${pulse ? 'live-pulse' : ''}`} />
      {String(level).toUpperCase()}
    </span>
  )
}

// ── Risk Color Utility ──
export const getRiskColor = (level: string): string => {
  const l = level.toLowerCase()
  if (l === 'critical') return '#ef4444'
  if (l === 'warning' || l === 'high') return '#f59e0b'
  if (l === 'normal' || l === 'healthy') return '#22c55e'
  return '#64748b'
}
