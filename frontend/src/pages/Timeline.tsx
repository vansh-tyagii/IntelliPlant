import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Select } from 'antd'
import { Clock, Download } from 'lucide-react'
import { dashboardService } from '@/services/dashboardService'
import { plantService } from '@/services/plantService'
import { StatusBadge, getRiskColor } from '@/components/ui/StatusBadge'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ExportModal } from '@/features/export/ExportModal'
import { useAppStore } from '@/store/appStore'
import type { TimelineEvent } from '@/types/api'

const SOURCE_COLORS: Record<string, string> = {
  ai4i: '#b3c5ff',
  swat: '#22c55e',
  ppe: '#f59e0b',
  fusion: '#9c27b0',
  incident: '#ef4444',
  system: '#8c90a1',
}

const ZONES = ['all', 'boiler-room', 'machine-hall', 'control-room', 'assembly-line', 'warehouse', 'maintenance', 'packing', 'chemical-storage', 'loading-bay', 'utility-area']

export const Timeline: React.FC = () => {
  const mode = useAppStore((s) => s.mode)
  const [filterZone, setFilterZone] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [exportOpen, setExportOpen] = useState(false)

  const { data: timelineData, isLoading } = useQuery({
    queryKey: ['timeline'],
    queryFn: dashboardService.getTimeline,
    refetchInterval: mode === 'live' ? 10000 : false,
  })

  const events: TimelineEvent[] = (timelineData?.events as TimelineEvent[]) || []

  const filtered = events.filter((e) => {
    const zoneOk = filterZone === 'all' || e.zone_id === filterZone || e.zone_name?.toLowerCase().includes(filterZone)
    const sourceOk = filterSource === 'all' || (e.source || '').toLowerCase().includes(filterSource)
    return zoneOk && sourceOk
  })

  if (isLoading) return (
    <div className="p-6"><LoadingSkeleton variant="row" count={8} /></div>
  )

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[rgba(179,197,255,0.15)] border border-[#b3c5ff] flex items-center justify-center">
            <Clock size={18} className="text-[#b3c5ff]" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">Plant Event Timeline</h2>
            <p className="font-sans text-xs text-[#8c90a1]">{filtered.length} events · Chronological plant activity log</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={filterZone}
            onChange={setFilterZone}
            options={ZONES.map(z => ({ value: z, label: z === 'all' ? 'All Zones' : z.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))}
            style={{ width: 160 }}
            size="middle"
          />
          <Select
            value={filterSource}
            onChange={setFilterSource}
            options={[
              { value: 'all', label: 'All Sources' },
              ...['ai4i', 'swat', 'ppe', 'fusion', 'incident', 'system'].map(s => ({ value: s, label: s.toUpperCase() })),
            ]}
            style={{ width: 140 }}
            size="middle"
          />
          <Button
            icon={<Download size={14} />}
            onClick={() => setExportOpen(true)}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 bg-[#191b24] border border-[#424656] px-4 py-2">
        {Object.entries(SOURCE_COLORS).map(([src, color]) => (
          <div key={src} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">{src}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-0 bottom-0 w-px bg-[#272a33]" />

        <div className="space-y-0">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[#8c90a1]">
              <div className="text-center">
                <Clock size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-sans text-sm">No timeline events</p>
                <p className="font-sans text-xs opacity-60 mt-1">Events appear as AI modules run</p>
              </div>
            </div>
          ) : filtered.map((event, i) => {
            const sourceKey = (event.source || 'system').toLowerCase().replace(/[^a-z]/g, '')
            const dotColor = SOURCE_COLORS[sourceKey] || '#8c90a1'
            const riskColor = getRiskColor(event.risk_level || 'unknown')

            return (
              <div key={i} className="flex gap-4 group">
                {/* Dot */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
                  <div
                    className="w-3 h-3 rounded-full border-2 border-[#10131c] mt-4 shrink-0 z-10"
                    style={{ background: dotColor }}
                  />
                </div>

                {/* Content */}
                <div className={`flex-1 py-3 border-b border-[#1d1f28] group-hover:bg-[#1d1f28] transition-colors px-2 -mx-2 rounded ${i === 0 ? 'fade-in' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: `${dotColor}20`, color: dotColor, border: `1px solid ${dotColor}40` }}
                        >
                          {event.source || 'SYSTEM'}
                        </span>
                        {event.risk_level && event.risk_level !== 'unknown' && (
                          <StatusBadge level={event.risk_level} size="sm" />
                        )}
                        {event.zone_name && (
                          <span className="font-sans text-[10px] text-[#8c90a1]">{event.zone_name}</span>
                        )}
                      </div>
                      <p className="font-sans text-sm text-[#e1e2ee]">
                        {event.message || event.description || 'Event recorded'}
                      </p>
                      {event.recommendation && (
                        <p className="font-sans text-xs text-[#8c90a1] mt-1 leading-relaxed">
                          → {event.recommendation}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[#8c90a1] shrink-0 whitespace-nowrap">
                      {event.timestamp
                        ? new Date(event.timestamp).toLocaleTimeString('en-IN', { hour12: false })
                        : '--:--'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        data={filtered}
        title="Plant Timeline"
        filename={`timeline-${Date.now()}`}
      />
    </div>
  )
}
