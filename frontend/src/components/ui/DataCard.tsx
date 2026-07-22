import React from 'react'
import type { ReactNode } from 'react'

interface DataCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: 'primary' | 'critical' | 'warning' | 'normal' | 'neutral'
  icon?: ReactNode
  className?: string
  onClick?: () => void
}

const ACCENTS = {
  primary: 'text-[#b3c5ff]',
  critical: 'text-[#ef4444]',
  warning: 'text-[#f59e0b]',
  normal: 'text-[#22c55e]',
  neutral: 'text-[#e1e2ee]',
}

export const DataCard: React.FC<DataCardProps> = ({
  label, value, sub, accent = 'primary', icon, className = '', onClick
}) => (
  <div
    onClick={onClick}
    className={`bg-[#191b24] border border-[#424656] p-4 flex flex-col justify-between gap-3 fade-in ${onClick ? 'cursor-pointer hover:bg-[#272a33] transition-colors' : ''} ${className}`}
  >
    <div className="flex items-start justify-between">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-[#8c90a1]">{label}</p>
      {icon && <span className="text-[#424656]">{icon}</span>}
    </div>
    <div className={`font-display font-bold text-3xl leading-tight ${ACCENTS[accent]}`}>{value}</div>
    {sub && (
      <div className="flex items-center gap-1 text-[#8c90a1]">
        <span className="font-mono text-[11px]">{sub}</span>
      </div>
    )}
  </div>
)
