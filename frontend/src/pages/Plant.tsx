import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Select, Tooltip } from 'antd'
import { Maximize2 } from 'lucide-react'
import { dashboardService } from '@/services/dashboardService'
import { plantService } from '@/services/plantService'
import { scenarioService } from '@/services/scenarioService'
import { useAppStore } from '@/store/appStore'
import { HeatmapCanvas } from '@/features/plant/HeatmapCanvas'
import { ZoneInspectionDrawer } from '@/features/plant/ZoneInspectionDrawer'
import { MissionControl } from '@/features/plant/MissionControl'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export const Plant: React.FC = () => {
  const mode = useAppStore((s) => s.mode)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [missionControlOpen, setMissionControlOpen] = useState(false)

  const { data: heatmap, isLoading: heatmapLoading } = useQuery({
    queryKey: ['plant-heatmap'],
    queryFn: dashboardService.getHeatmap,
    refetchInterval: mode === 'live' ? 5000 : false,
  })

  const { data: layout, isLoading: layoutLoading } = useQuery({
    queryKey: ['plant-layout'],
    queryFn: plantService.getPlantLayout,
    staleTime: Infinity,
  })

  const { data: scenariosData } = useQuery({
    queryKey: ['scenarios'],
    queryFn: scenarioService.getScenarios,
    staleTime: 30000,
  })

  const { data: zones } = useQuery({
    queryKey: ['zones-list'],
    queryFn: plantService.getZones,
    refetchInterval: mode === 'live' ? 10000 : false,
  })

  const handleZoneClick = (zoneId: string) => {
    setSelectedZone(zoneId)
    useAppStore.getState().setCurrentZone(zoneId)
    setDrawerOpen(true)
  }

  const handleScenarioLoad = async (scenarioId: string) => {
    await scenarioService.loadScenario(scenarioId)
  }

  if (heatmapLoading || layoutLoading) return (
    <div className="p-6"><LoadingSkeleton variant="chart" className="h-[600px]" /></div>
  )

  const cells = heatmap?.cells || []
  const criticalCount = cells.filter((c) => c.risk_level === 'critical').length
  const warningCount = cells.filter((c) => c.risk_level === 'warning').length
  const normalCount = cells.filter((c) => c.risk_level === 'normal').length

  return (
    <div className="p-6 space-y-4 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">Plant Digital Twin</h2>
          <p className="font-sans text-xs text-[#8c90a1] mt-0.5">
            Interactive factory heatmap · {cells.length} zones monitored
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Scenario selector (Demo mode only) */}
          {mode === 'demo' && (
            <Select
              placeholder="Load scenario…"
              style={{ width: 200 }}
              onChange={handleScenarioLoad}
              options={(scenariosData?.scenarios || []).map((s) => ({ value: s.scenario_id, label: s.name }))}
              size="middle"
            />
          )}
          <Tooltip title="Mission Control — Fullscreen">
            <Button
              type="primary"
              icon={<Maximize2 size={14} />}
              onClick={() => setMissionControlOpen(true)}
            >
              Mission Control
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Critical', count: criticalCount, level: 'critical' as const },
          { label: 'Warning', count: warningCount, level: 'warning' as const },
          { label: 'Normal', count: normalCount, level: 'normal' as const },
        ].map(({ label, count, level }) => (
          <div key={label} className="bg-[#191b24] border border-[#424656] p-3 flex items-center justify-between">
            <span className="font-sans text-xs text-[#8c90a1]">{label} Zones</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-[#e1e2ee]">{count}</span>
              <StatusBadge level={level} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap canvas */}
      <div className="bg-[#191b24] border border-[#424656] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#272a33]">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-[#8c90a1]">
            Interactive Plant Map · {mode === 'live' ? 'Live' : 'Demo'} Mode
          </p>
          <div className="flex items-center gap-4 text-[10px] font-mono text-[#8c90a1]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444]" /> Critical</span>
          </div>
        </div>
        <ErrorBoundary moduleName="Plant Heatmap">
          <HeatmapCanvas
            cells={cells}
            layout={layout}
            onZoneClick={handleZoneClick}
            selectedZoneId={selectedZone}
          />
        </ErrorBoundary>
      </div>

      {/* Zone list */}
      <div className="bg-[#191b24] border border-[#424656]">
        <div className="px-4 py-3 border-b border-[#272a33]">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-[#8c90a1]">All Zones</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-[#272a33]">
          {(zones?.zones || cells.map((c) => ({ ...c, zone_name: c.zone_name, display_name: c.zone_name, zone_id: c.zone_id, risk_label: c.risk_level, risk_color: '', coordinates: {}, icon: '', timeline: [], metadata: c.metadata || {} }))).map((zone) => {
            const cell = cells.find((c) => c.zone_id === zone.zone_id)
            return (
              <button
                key={zone.zone_id}
                onClick={() => handleZoneClick(zone.zone_id)}
                className="bg-[#191b24] p-3 text-left hover:bg-[#272a33] transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-sans text-xs font-semibold text-[#e1e2ee] truncate">{zone.zone_name || zone.display_name}</p>
                  <StatusBadge level={cell?.risk_level || 'unknown'} size="sm" />
                </div>
                <p className="font-mono text-[9px] text-[#8c90a1]">{(zone.metadata as { area_type?: string })?.area_type || '--'}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Drawers + overlays */}
      <ZoneInspectionDrawer zoneId={selectedZone} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MissionControl open={missionControlOpen} onClose={() => setMissionControlOpen(false)} />
    </div>
  )
}
