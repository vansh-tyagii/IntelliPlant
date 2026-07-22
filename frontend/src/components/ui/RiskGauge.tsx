import React from 'react'

interface RiskGaugeProps {
  score: number  // 0–100 from backend
  size?: number
  showLabel?: boolean
  level?: string
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, size = 140, showLabel = true, level }) => {
  const r = 40
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100)

  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#22c55e'
  const labelStr = level || (score >= 70 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW')

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="transparent" stroke="#32343e" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r}
          fill="transparent"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease-out, stroke 0.5s' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-[#e1e2ee]" style={{ fontSize: size * 0.18 }}>
            {Math.round(score)}%
          </span>
          <span className="font-mono text-[#8c90a1] uppercase tracking-wider" style={{ fontSize: size * 0.09 }}>
            {labelStr}
          </span>
        </div>
      )}
    </div>
  )
}
