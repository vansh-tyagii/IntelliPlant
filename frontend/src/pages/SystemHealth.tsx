import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, Cpu, Server } from 'lucide-react'
import { healthService } from '@/services/healthService'
import { dashboardService } from '@/services/dashboardService'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DataCard } from '@/components/ui/DataCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

export const SystemHealth: React.FC = () => {
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health-page'],
    queryFn: healthService.getSystemHealth,
    refetchInterval: 15000,
  })

  const { data: status } = useQuery({
    queryKey: ['api-status'],
    queryFn: healthService.getStatus,
    refetchInterval: 30000,
  })

  const { data: modules } = useQuery({
    queryKey: ['runtime-modules-page'],
    queryFn: healthService.getRuntimeModules,
    refetchInterval: 30000,
  })

  const { data: runtimeState } = useQuery({
    queryKey: ['runtime-state-system'],
    queryFn: dashboardService.getRuntimeState,
    refetchInterval: 15000,
  })

  const { data: config } = useQuery({
    queryKey: ['system-config'],
    queryFn: healthService.getSystemConfig,
    staleTime: Infinity,
  })

  const uptime = health?.uptime_seconds
    ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m ${Math.floor(health.uptime_seconds % 60)}s`
    : '--'

  const modulesCount = modules?.known_modules?.length ?? 0
  const zoneCount = Object.keys(modules?.loaded_by_zone || {}).length

  if (healthLoading) return <div className="p-6"><LoadingSkeleton variant="card" count={4} className="grid grid-cols-4 gap-4" /></div>

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[rgba(34,197,94,0.15)] border border-[#22c55e] flex items-center justify-center">
          <Activity size={18} className="text-[#22c55e]" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">System Health</h2>
          <p className="font-sans text-xs text-[#8c90a1]">Backend status, module health, and runtime diagnostics</p>
        </div>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DataCard
          label="System Status"
          value={health?.status?.toUpperCase() || 'UNKNOWN'}
          accent={health?.status === 'healthy' ? 'normal' : 'warning'}
          icon={health?.status === 'healthy' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
        />
        <DataCard
          label="Backend Uptime"
          value={uptime}
          sub="Since last restart"
          accent="primary"
          icon={<Clock size={16} />}
        />
        <DataCard
          label="Modules Online"
          value={`${modulesCount}`}
          sub={`Across ${zoneCount} zones`}
          accent="normal"
          icon={<Cpu size={16} />}
        />
        <DataCard
          label="RAG Status"
          value={status?.rag_ready ? 'Online' : 'Offline'}
          sub={status?.rag_error ? String(status.rag_error).slice(0, 40) : 'Knowledge base ready'}
          accent={status?.rag_ready ? 'normal' : 'warning'}
          icon={<Server size={16} />}
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Module registry */}
        <div className="col-span-12 lg:col-span-5 bg-[#191b24] border border-[#424656] p-5">
          <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-4 flex items-center gap-2">
            <Cpu size={14} className="text-[#b3c5ff]" /> Registered Modules
          </h3>
          <div className="space-y-2">
            {(modules?.known_modules || []).map((mod) => (
              <div key={mod} className="flex items-center justify-between p-2.5 border border-[#272a33] hover:bg-[#272a33] transition-colors">
                <div className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-[#22c55e]" />
                  <span className="font-mono text-xs text-[#c2c6d8]">{mod}</span>
                </div>
                <span className="font-mono text-[9px] bg-[rgba(34,197,94,0.15)] text-[#22c55e] border border-[#22c55e40] px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
            ))}
            {modulesCount === 0 && (
              <p className="font-mono text-xs text-[#424656] py-4 text-center">No modules registered</p>
            )}
          </div>
        </div>

        {/* Active Agents + API Status */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* API agents */}
          <div className="bg-[#191b24] border border-[#424656] p-5">
            <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-4">Active Agents</h3>
            <div className="grid grid-cols-3 gap-2">
              {(status?.agents || []).map((agent) => (
                <div key={agent} className="bg-[#272a33] border border-[#424656] p-2.5 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span className="font-mono text-[10px] text-[#c2c6d8] truncate">{agent}</span>
                </div>
              ))}
              {(status?.agents || []).length === 0 && (
                <p className="col-span-3 font-mono text-xs text-[#424656] py-4 text-center">No agents listed</p>
              )}
            </div>
          </div>

          {/* Zones loaded */}
          <div className="bg-[#191b24] border border-[#424656] p-5">
            <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-4">Zones with Loaded Modules</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(modules?.loaded_by_zone || {}).map(([zone, mods]) => (
                <div key={zone} className="flex items-start gap-3 border-b border-[#272a33] py-2">
                  <span className="font-mono text-xs text-[#b3c5ff] w-32 shrink-0">{zone}</span>
                  <div className="flex flex-wrap gap-1">
                    {(mods as string[]).map((m) => (
                      <span key={m} className="font-mono text-[9px] px-1.5 py-0.5 bg-[#272a33] border border-[#424656] text-[#8c90a1] rounded">{m}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Runtime snapshot */}
          <div className="bg-[#191b24] border border-[#424656] p-5">
            <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-3">Runtime Snapshot</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Last Update', value: runtimeState?.last_update ? new Date(runtimeState.last_update).toLocaleTimeString('en-IN', { hour12: false }) : 'N/A' },
                { label: 'Active Zones', value: Object.keys(runtimeState?.zones || {}).length },
                { label: 'API Version', value: status?.status || 'N/A' },
                { label: 'RAG', value: status?.rag_ready ? '✓ Ready' : '✗ Not ready' },
              ].map((item) => (
                <div key={item.label} className="bg-[#272a33] p-3 border border-[#424656]">
                  <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="font-mono text-sm text-[#e1e2ee]">{String(item.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Config JSON viewer */}
      {config && (
        <div className="bg-[#191b24] border border-[#424656] p-5">
          <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-3">System Configuration</h3>
          <pre className="bg-[#0b0e16] border border-[#424656] p-4 text-[10px] font-mono text-[#b3c5ff] overflow-auto max-h-48 rounded">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
