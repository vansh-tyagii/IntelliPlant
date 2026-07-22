import React from 'react'

interface LoadingSkeletonProps {
  variant?: 'card' | 'row' | 'chart' | 'text'
  count?: number
  className?: string
}

const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-[#272a33] rounded animate-pulse ${className}`} />
)

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ variant = 'card', count = 1, className = '' }) => {
  if (variant === 'text') return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className="h-4 w-full" />
      ))}
    </div>
  )

  if (variant === 'row') return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border border-[#424656] bg-[#191b24]">
          <Shimmer className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3 w-2/3" />
            <Shimmer className="h-2 w-1/2" />
          </div>
          <Shimmer className="h-5 w-16" />
        </div>
      ))}
    </div>
  )

  if (variant === 'chart') return (
    <div className={`bg-[#191b24] border border-[#424656] p-4 ${className}`}>
      <Shimmer className="h-4 w-32 mb-4" />
      <Shimmer className="h-48 w-full" />
    </div>
  )

  // Card
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#191b24] border border-[#424656] p-4 space-y-3">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-16" />
          <Shimmer className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}
