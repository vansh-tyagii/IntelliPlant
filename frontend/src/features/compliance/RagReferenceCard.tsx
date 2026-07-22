import React from 'react'

interface RagReferenceCardProps {
  source: string
  excerpt: string
  section?: string
}

const SOURCE_CONFIG: Record<string, { accent: string; bg: string; icon: string }> = {
  'OISD': { accent: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '📋' },
  'Factories Act': { accent: '#b3c5ff', bg: 'rgba(179,197,255,0.1)', icon: '⚖️' },
  'DGMS': { accent: '#9c27b0', bg: 'rgba(156,39,176,0.1)', icon: '🔖' },
  'IS Standard': { accent: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '📐' },
  'General': { accent: '#8c90a1', bg: 'rgba(140,144,161,0.1)', icon: '📄' },
}

// Parse regulatory references from text
export function parseReferences(text: string): { source: string; excerpt: string; section?: string }[] {
  const refs: { source: string; excerpt: string; section?: string }[] = []
  const patterns: [RegExp, string][] = [
    [/OISD[- ]?(\d+[A-Z]?)[^\n]*/gi, 'OISD'],
    [/Factories Act[^\n]*/gi, 'Factories Act'],
    [/DGMS[^\n]*/gi, 'DGMS'],
    [/IS[- ]\d+[^\n]*/gi, 'IS Standard'],
  ]
  for (const [pattern, source] of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      refs.push({ source, excerpt: matches[0].slice(0, 200) })
    }
  }
  return refs
}

export const RagReferenceCard: React.FC<RagReferenceCardProps> = ({ source, excerpt, section }) => {
  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG['General']
  return (
    <div
      className="rounded border p-3 fade-in"
      style={{ background: cfg.bg, borderColor: cfg.accent, borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{cfg.icon}</span>
        <p className="font-display font-semibold text-sm" style={{ color: cfg.accent }}>{source}</p>
        {section && <span className="font-mono text-[10px] text-[#8c90a1]">{section}</span>}
      </div>
      <p className="font-sans text-xs text-[#c2c6d8] leading-relaxed line-clamp-3">{excerpt}</p>
    </div>
  )
}
