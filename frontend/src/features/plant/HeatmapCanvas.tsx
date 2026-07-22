import React, { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip } from 'antd'
import { dashboardService } from '@/services/dashboardService'
import { plantService } from '@/services/plantService'
import { StatusBadge, getRiskColor } from '@/components/ui/StatusBadge'
import { useAppStore } from '@/store/appStore'
import type { HeatmapCell, ZoneView } from '@/types/api'
import {
  Flame, Settings, Monitor, Package, Warehouse, Wrench, Factory, Truck, Zap, MapPin
} from 'lucide-react'

const ZONE_ICONS: Record<string, React.ReactNode> = {
  'boiler-room': <Flame size={14} />, 'machine-hall': <Settings size={14} />,
  'control-room': <Monitor size={14} />, 'assembly-line': <Factory size={14} />,
  'warehouse': <Warehouse size={14} />, 'maintenance': <Wrench size={14} />,
  'packing': <Package size={14} />, 'chemical-storage': <Zap size={14} />,
  'loading-bay': <Truck size={14} />, 'utility-area': <Zap size={14} />,
}

interface ZoneTooltipContent {
  cell: HeatmapCell
  zone?: ZoneView
}

const ZoneTooltip: React.FC<ZoneTooltipContent> = ({ cell, zone }) => (
  <div className="min-w-[200px]">
    <p className="font-display font-semibold text-sm text-[#e1e2ee] mb-2">{cell.zone_name}</p>
    <div className="space-y-1 font-mono text-[11px]">
      <div className="flex justify-between gap-4">
        <span className="text-[#8c90a1]">Risk Level</span>
        <StatusBadge level={cell.risk_level} size="sm" />
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-[#8c90a1]">Risk Score</span>
        <span className="text-[#b3c5ff]">{cell.risk_score}%</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-[#8c90a1]">Fusion</span>
        <span className="text-[#e1e2ee]">{cell.fusion_status || 'N/A'}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-[#8c90a1]">Area Type</span>
        <span className="text-[#e1e2ee]">{cell.metadata?.area_type || '--'}</span>
      </div>
      {cell.last_update && (
        <div className="flex justify-between gap-4 pt-1 border-t border-[#424656] mt-1">
          <span className="text-[#8c90a1]">Updated</span>
          <span className="text-[#8c90a1]">
            {new Date(cell.last_update).toLocaleTimeString('en-IN', { hour12: false })}
          </span>
        </div>
      )}
    </div>
    <p className="font-sans text-[9px] text-[#424656] mt-2">Click to inspect zone</p>
  </div>
)

interface HeatmapCanvasProps {
  cells: HeatmapCell[]
  layout?: { canvas: { width: number; height: number }; zones: ZoneView[] }
  onZoneClick: (zoneId: string) => void
  selectedZoneId?: string | null
  compact?: boolean
}

export const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({
  cells, layout, onZoneClick, selectedZoneId, compact = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasW = layout?.canvas?.width || 1440
  const canvasH = layout?.canvas?.height || 810

  const cellMap = Object.fromEntries((cells || []).map((c) => [c.zone_id, c]))
  const zones = layout?.zones || []

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-[#0b0e16]" style={{ aspectRatio: `${canvasW}/${canvasH}` }}>
      {/* Background texture */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(#b3c5ff 1px,transparent 1px),linear-gradient(90deg,#b3c5ff 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Render zone rectangles */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${canvasW} ${canvasH}`} preserveAspectRatio="xMidYMid meet">
        {zones.map((zone) => {
          const cell = cellMap[zone.zone_id]
          const { x = 0, y = 0, width = 200, height = 120 } = zone.coordinates || {}
          const riskColor = getRiskColor(cell?.risk_level || 'unknown')
          const isSelected = selectedZoneId === zone.zone_id

          return (
            <g key={zone.zone_id}>
              {/* Zone fill */}
              <rect
                x={x} y={y} width={width} height={height}
                fill={riskColor}
                fillOpacity={isSelected ? 0.35 : 0.18}
                stroke={riskColor}
                strokeWidth={isSelected ? 2 : 1}
                strokeOpacity={0.8}
                rx={4}
                style={{ cursor: 'pointer', transition: 'fill-opacity 0.2s' }}
              />
              {/* Zone label */}
              {!compact && (
                <text
                  x={x + width / 2} y={y + height / 2 - 8}
                  textAnchor="middle"
                  fill="#e1e2ee"
                  fontSize="11"
                  fontFamily="Inter"
                  fontWeight="600"
                  style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {zone.zone_name}
                </text>
              )}
              <text
                x={x + width / 2} y={y + height / 2 + (compact ? 4 : 8)}
                textAnchor="middle"
                fill={riskColor}
                fontSize="10"
                fontFamily="JetBrains Mono"
                fontWeight="700"
                style={{ pointerEvents: 'none' }}
              >
                {(cell?.risk_level || 'UNKNOWN').toUpperCase()}
              </text>
              {/* Click overlay */}
              <rect
                x={x} y={y} width={width} height={height}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => onZoneClick(zone.zone_id)}
              />
            </g>
          )
        })}
      </svg>

      {/* Tooltip overlays (positioned via foreignObject would cause issues; handled via HTML overlay) */}
      {zones.map((zone) => {
        const cell = cellMap[zone.zone_id]
        if (!cell) return null
        const { x = 0, y = 0, width = 200, height = 120 } = zone.coordinates || {}
        // Convert canvas coords to percentage for CSS positioning
        const leftPct = ((x + width / 2) / canvasW) * 100
        const topPct = ((y + height / 2) / canvasH) * 100

        return (
          <Tooltip
            key={zone.zone_id}
            title={<ZoneTooltip cell={cell} zone={zone} />}
            placement="right"
            overlayStyle={{ maxWidth: 260 }}
            mouseEnterDelay={0.15}
          >
            <div
              className="absolute"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${(width / canvasW) * 100}%`,
                height: `${(height / canvasH) * 100}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
              }}
              onClick={() => onZoneClick(zone.zone_id)}
            />
          </Tooltip>
        )
      })}
    </div>
  )
}

// Export standalone for reuse
export { HeatmapCanvas as default }
