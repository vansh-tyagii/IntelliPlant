import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardService } from '@/services/dashboardService'
import { healthService } from '@/services/healthService'
import { DataCard } from '@/components/ui/DataCard'
import { StatusBadge, getRiskColor } from '@/components/ui/StatusBadge'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { RiskGauge } from '@/components/ui/RiskGauge'
import { ZoneRiskRadar } from '@/components/charts/ZoneRiskRadar'
import { useAppStore } from '@/store/appStore'
import {
  AlertTriangle, CheckCircle, Clock, Activity, Server, TrendingUp, MapPin, Zap
} from 'lucide-react'

export const Overview: React.FC = () => {
  const navigate = useNavigate()
  const mode = useAppStore((s) => s.mode)

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardService.getDashboard,
    refetchInterval: mode === 'live' ? 10000 : false,
  })

  const { data: heatmap } = useQuery({
    queryKey: ['heatmap'],
    queryFn: dashboardService.getHeatmap,
    refetchInterval: mode === 'live' ? 10000 : false,
  })

  const { data: health } = useQuery({
    queryKey: ['system-health-overview'],
    queryFn: healthService.getSystemHealth,
    refetchInterval: 30000,
  })

  const { data: modules } = useQuery({
    queryKey: ['runtime-modules'],
    queryFn: healthService.getRuntimeModules,
    refetchInterval: 30000,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-overview'],
    queryFn: dashboardService.getAlerts,
    refetchInterval: mode === 'live' ? 10000 : 30000,
  })

  const uptime = health?.uptime_seconds
    ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m`
    : '--'
  const modulesOnline = modules?.known_modules?.length ?? 0
  const criticalCount = dash?.critical_zones?.length ?? 0
  const alertCount = alertsData?.alerts?.length ?? 0

  if (dashLoading) return (
    <div className="p-6">
      <LoadingSkeleton variant="card" count={3} className="grid grid-cols-4 gap-4 mb-6" />
      <LoadingSkeleton variant="chart" className="mb-6" />
    </div>
  )

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">Executive Overview</h2>
          <p className="font-sans text-xs text-[#8c90a1] mt-0.5">
            {dash?.timestamp ? new Date(dash.timestamp).toLocaleString('en-IN') : 'Real-time plant intelligence dashboard'}
          </p>
        </div>
        <StatusBadge level={health?.status === 'healthy' ? 'normal' : 'warning'} pulse={mode === 'live'} size="lg" />
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <DataCard
          label="Monitored Zones"
          value={dash?.plant_statistics?.total_zones ?? '--'}
          sub="Current backend snapshot"
          accent="primary"
          icon={<CheckCircle size={16} />}
          className="col-span-1"
        />
        <DataCard
          label="Warning Zones"
          value={dash?.plant_statistics?.warning_count ?? '--'}
          sub="Current backend snapshot"
          accent="neutral"
          icon={<Activity size={16} />}
          className="col-span-1"
        />
        <DataCard
          label="Active Zones"
          value={heatmap?.cells?.length ?? '--'}
          sub={`${criticalCount} critical`}
          accent={criticalCount > 0 ? 'critical' : 'normal'}
          icon={<MapPin size={16} />}
          className="col-span-1"
          onClick={() => navigate('/plant')}
        />
        <DataCard
          label="Today's Alerts"
          value={alertCount}
          sub={`${dash?.critical_zones?.length ?? 0} high priority`}
          accent={alertCount > 0 ? 'warning' : 'normal'}
          icon={<AlertTriangle size={16} />}
          className="col-span-1"
        />
        <DataCard
          label="Top Critical Zones"
          value={criticalCount === 0 ? 'None' : criticalCount}
          sub={dash?.critical_zones?.[0]?.zone_name || 'All clear'}
          accent={criticalCount > 0 ? 'critical' : 'normal'}
          icon={<Zap size={16} />}
          className="col-span-1"
          onClick={() => navigate('/plant')}
        />
        <DataCard
          label="Backend Uptime"
          value={uptime}
          sub="Backend uptime"
          accent="normal"
          icon={<Server size={16} />}
          className="col-span-1"
        />
        <DataCard
          label="System Health"
          value={health?.status ?? '--'}
          sub="Backend-reported status"
          accent="normal"
          icon={<Clock size={16} />}
          className="col-span-1"
        />
        <DataCard
          label="Models Online"
          value={`${modulesOnline}/${modulesOnline}`}
          sub="Runtime module catalog"
          accent="normal"
          icon={<Activity size={16} />}
          className="col-span-1"
        />
      </div>

      {/* Main row: Risk gauge + Incidents + Module health */}
      <div className="grid grid-cols-12 gap-4">
        {/* Plant Risk Gauge */}
        <div className="col-span-12 lg:col-span-3 bg-[#191b24] border border-[#424656] p-5 flex flex-col items-center justify-center gap-3">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-[#8c90a1] self-start">Overall Plant Risk</p>
          <RiskGauge score={dash?.average_risk ?? 0} level={dash?.average_risk && dash.average_risk > 70 ? 'CRITICAL' : dash?.average_risk && dash.average_risk > 40 ? 'MODERATE' : 'LOW'} />
          <p className="font-sans text-xs text-[#8c90a1] text-center">
            {dash?.plant_statistics ? `${dash.plant_statistics.total_zones} zones monitored` : 'System nominal'}
          </p>
        </div>

        {/* Active Incidents */}
        <div className="col-span-12 lg:col-span-4 bg-[#191b24] border border-[#424656] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-[#e1e2ee]">Active Incidents</h3>
            {(dash?.active_incidents?.length ?? 0) > 0 && (
              <span className="font-mono text-[10px] bg-[#93000a] text-[#ffdad6] px-2 py-0.5 rounded">
                {dash!.active_incidents.length} ACTIVE
              </span>
            )}
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {(dash?.active_incidents || []).slice(0, 4).map((inc, i) => (
              <div key={i} className={`border-l-4 p-3 hover:bg-[#272a33] cursor-pointer transition-colors`}
                style={{ borderLeftColor: getRiskColor(inc.risk_level || 'unknown') }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase" style={{ color: getRiskColor(inc.risk_level || 'unknown') }}>
                      {inc.risk_level?.toUpperCase() || 'UNKNOWN'}
                    </p>
                    {/* root_cause is the real field; summary may not exist */}
                    <p className="font-sans text-sm text-[#e1e2ee] font-semibold mt-0.5">{inc.root_cause || inc.summary || 'Incident detected'}</p>
                  </div>
                  <span className="font-mono text-[10px] text-[#8c90a1] shrink-0">
                    {/* Backend uses timestamp_utc in /api/incidents */}
                    {(inc.timestamp_utc || inc.timestamp) ? new Date(inc.timestamp_utc || inc.timestamp!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--'}
                  </span>
                </div>
                <p className="font-sans text-xs text-[#8c90a1] mt-1">{inc.zone || inc.zone_id || inc.affected_zone || 'Unknown zone'}</p>
              </div>
            ))}
            {(!dash?.active_incidents?.length) && (
              <div className="flex items-center justify-center h-24 text-[#8c90a1]">
                <div className="text-center">
                  <CheckCircle size={20} className="text-[#22c55e] mx-auto mb-2" />
                  <p className="font-sans text-xs">No active incidents</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Critical Zones list */}
        <div className="col-span-12 lg:col-span-5 bg-[#191b24] border border-[#424656] p-5">
          <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-4">Critical Zones Status</h3>
          <div className="space-y-1">
            {[...(dash?.critical_zones || []), ...(dash?.warning_zones || []), ...(dash?.safe_zones || [])].slice(0, 8).map((zone, i) => (
              <div key={i}
                className="flex items-center justify-between p-2.5 border-b border-[#272a33] hover:bg-[#272a33] cursor-pointer transition-colors"
                onClick={() => { useAppStore.getState().setCurrentZone(zone.zone_id); navigate('/plant') }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: getRiskColor(zone.risk_level) }} />
                  <span className="font-sans text-sm text-[#e1e2ee]">{zone.zone_name || zone.display_name}</span>
                </div>
                <StatusBadge level={zone.risk_level} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second row: Zone radar + Activity timeline */}
      <div className="grid grid-cols-12 gap-4">
        {/* Zone Risk Radar */}
        <ErrorBoundary moduleName="Radar Chart">
          <div className="col-span-12 lg:col-span-5 bg-[#191b24] border border-[#424656] p-5">
            <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-4">Zone Risk Distribution</h3>
            {heatmap?.cells ? (
              <ZoneRiskRadar cells={heatmap.cells} height={280} />
            ) : (
              <LoadingSkeleton variant="chart" />
            )}
          </div>
        </ErrorBoundary>

        {/* Module Health grid */}
        <div className="col-span-12 lg:col-span-4 bg-[#191b24] border border-[#424656] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-[#e1e2ee]">Module Health</h3>
            <Activity size={16} className="text-[#b3c5ff]" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(modules?.known_modules || []).map((mod) => (
              <div key={mod} className="bg-[#272a33] border border-[#424656] p-2 flex flex-col items-center gap-1">
                <span className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider text-center">{mod.slice(0, 6)}</span>
                <div className="w-full h-1 bg-[#22c55e] rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Today's Alerts */}
        <div className="col-span-12 lg:col-span-3 bg-[#191b24] border border-[#424656] p-5">
          <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-4">Today's Alerts</h3>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {(alertsData?.alerts || []).slice(0, 5).map((alert, i) => (
              <div key={i} className="flex items-start gap-2 p-2 border-b border-[#272a33]">
                <StatusBadge level={alert.risk_level || 'unknown'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-xs text-[#e1e2ee] truncate">{alert.zone_name}</p>
                  <p className="font-mono text-[10px] text-[#8c90a1]">
                    {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour12: false }) : '--'}
                  </p>
                </div>
              </div>
            ))}
            {!alertsData?.alerts?.length && (
              <div className="flex items-center justify-center h-20 text-[#22c55e]">
                <div className="text-center">
                  <CheckCircle size={16} className="mx-auto mb-1" />
                  <p className="font-sans text-xs">All clear</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
