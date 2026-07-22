import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { X, Zap } from 'lucide-react'
import { dashboardService } from '@/services/dashboardService'
import { plantService } from '@/services/plantService'
import { useAppStore } from '@/store/appStore'
import { HeatmapCanvas } from './HeatmapCanvas'
import { ZoneInspectionDrawer } from './ZoneInspectionDrawer'
import { StatusBadge, getRiskColor } from '@/components/ui/StatusBadge'

interface MissionControlProps {
  open: boolean
  onClose: () => void
}

export const MissionControl: React.FC<MissionControlProps> = ({ open, onClose }) => {
  const mode = useAppStore((s) => s.mode)
  const [selectedZone, setSelectedZone] = React.useState<string | null>(null)

  const { data: heatmap } = useQuery({
    queryKey: ['mc-heatmap'],
    queryFn: dashboardService.getHeatmap,
    refetchInterval: mode === 'live' ? 5000 : false,
    enabled: open,
  })

  const { data: layout } = useQuery({
    queryKey: ['mc-layout'],
    queryFn: plantService.getPlantLayout,
    enabled: open,
    staleTime: Infinity,
  })

  const { data: alerts } = useQuery({
    queryKey: ['mc-alerts'],
    queryFn: dashboardService.getAlerts,
    refetchInterval: mode === 'live' ? 5000 : false,
    enabled: open,
  })

  const { data: dash } = useQuery({
    queryKey: ['mc-dashboard'],
    queryFn: dashboardService.getDashboard,
    refetchInterval: mode === 'live' ? 5000 : false,
    enabled: open,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9000] bg-[#0b0e16] flex flex-col"
        >
          {/* Demo/Live indicator bar */}
          {mode === 'demo' && <div className="absolute top-0 left-0 right-0 h-1 bg-[#9c27b0] z-10" />}
          {mode === 'live' && <div className="absolute top-0 left-0 right-0 h-1 bg-[#22c55e] live-pulse z-10" />}

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-4 border-b border-[#272a33] glass shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-[#0066ff] flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl text-[#e1e2ee] tracking-tight">MISSION CONTROL</h1>
                <p className="font-mono text-[9px] text-[#8c90a1] tracking-[0.1em]">SENTINEL SAFETY PLATFORM · INDUSTRIAL AI INTELLIGENCE</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${
                mode === 'live' ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' : 'bg-[rgba(156,39,176,0.15)] text-[#9c27b0]'
              }`}>
                <span className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-[#22c55e] live-pulse' : 'bg-[#9c27b0]'}`} />
                {mode === 'live' ? 'Live Mode' : 'Demo Mode'}
              </div>
              <button onClick={onClose}
                className="flex items-center gap-2 text-[#8c90a1] hover:text-[#e1e2ee] text-xs font-bold uppercase tracking-wider border border-[#424656] px-3 py-1.5 rounded hover:bg-[#272a33] transition-colors">
                <X size={14} /> Exit
              </button>
            </div>
          </div>

          {/* Main heatmap */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-6">
              <HeatmapCanvas
                cells={heatmap?.cells || []}
                layout={layout}
                onZoneClick={(id) => setSelectedZone(id)}
                selectedZoneId={selectedZone}
                compact={false}
              />
            </div>

            {/* Bottom status bar */}
            <div className="grid grid-cols-3 gap-4 px-6 pb-6">
              {/* Critical zones */}
              <div className="glass border border-[#424656] p-4 rounded">
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-3">Critical Zones</p>
                {(dash?.critical_zones || []).length === 0 ? (
                  <p className="font-sans text-xs text-[#22c55e]">All zones nominal</p>
                ) : (
                  <div className="space-y-1">
                    {dash!.critical_zones.slice(0, 3).map((z, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: getRiskColor(z.risk_level) }} />
                        <span className="font-sans text-xs text-[#e1e2ee]">{z.zone_name}</span>
                        <StatusBadge level={z.risk_level} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active alerts */}
              <div className="glass border border-[#424656] p-4 rounded">
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-3">Active Alerts</p>
                {(alerts?.alerts || []).length === 0 ? (
                  <p className="font-sans text-xs text-[#22c55e]">No active alerts</p>
                ) : (
                  <div className="space-y-1">
                    {alerts!.alerts.slice(0, 3).map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <StatusBadge level={a.risk_level || 'unknown'} size="sm" />
                        <span className="font-sans text-xs text-[#e1e2ee] truncate">{a.zone_name}</span>
                      </div>
                    ))}
                    {alerts!.alerts.length > 3 && (
                      <p className="font-mono text-[10px] text-[#8c90a1]">+{alerts!.alerts.length - 3} more</p>
                    )}
                  </div>
                )}
              </div>

              {/* Module status */}
              <div className="glass border border-[#424656] p-4 rounded">
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-3">Module Status</p>
                <div className="grid grid-cols-4 gap-1">
                  {['AI4I', 'SWAT', 'PPE', 'Fusion', 'RAG', 'Agents', 'Twin', 'Incident'].map((mod) => (
                    <div key={mod} className="flex flex-col items-center gap-0.5">
                      <div className="w-full h-1 bg-[#22c55e] rounded" />
                      <span className="font-mono text-[8px] text-[#8c90a1] uppercase">{mod.slice(0, 4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Zone inspection drawer (on top of mission control) */}
          <ZoneInspectionDrawer
            zoneId={selectedZone}
            open={!!selectedZone}
            onClose={() => setSelectedZone(null)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
