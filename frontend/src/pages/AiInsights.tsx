import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select, Button, Empty } from 'antd'
import { Brain, TrendingUp, BarChart2 } from 'lucide-react'
import { plantService } from '@/services/plantService'
import { ragService } from '@/services/ragService'
import { dashboardService } from '@/services/dashboardService'
import { ShapContributionChart } from '@/components/charts/ShapContributionChart'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { Tabs } from 'antd'

const ZONES = ['machine-hall', 'boiler-room', 'control-room', 'assembly-line', 'warehouse', 'maintenance', 'packing', 'chemical-storage', 'loading-bay', 'utility-area']

export const AiInsights: React.FC = () => {
  const [selectedZone, setSelectedZone] = useState('machine-hall')

  const { data: zone, isLoading: zoneLoading } = useQuery({
    queryKey: ['ai-insights-zone', selectedZone],
    queryFn: () => plantService.getZone(selectedZone),
    staleTime: 30000,
  })

  const { data: fusionExplain, isLoading: shapLoading } = useQuery({
    queryKey: ['fusion-explain-insights', selectedZone],
    queryFn: () => ragService.getFusionExplain(selectedZone),
    staleTime: 30000,
    retry: 1,
  })

  const { data: runtimeState } = useQuery({
    queryKey: ['runtime-state-insights'],
    queryFn: dashboardService.getRuntimeState,
    staleTime: 10000,
  })

  const ai4i = zone?.latest_ai4i_output
  const swat = zone?.latest_swat_output
  const ppe = zone?.latest_ppe_output
  const fusion = zone?.fusion_output

  const tabItems = [
    {
      key: 'outputs',
      label: 'Module Outputs',
      children: (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
          {/* AI4I Result */}
          <div className="bg-[#272a33] border border-[#424656] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">AI4I — Machine</p>
            {/* ai4i.status is the risk indicator */}
              {ai4i?.status && <StatusBadge level={(ai4i.status as 'normal')} size="sm" />}
            </div>
            {ai4i ? (
              <div className="space-y-1">
                {([
                  ['prediction', String(ai4i.prediction ?? 'N/A')],
                  ['failure_type', String(ai4i.failure_type ?? 'N/A')],
                  ['confidence', ai4i.confidence != null ? `${(Number(ai4i.confidence) * 100).toFixed(1)}%` : 'N/A'],
                  ['risk_score', ai4i.risk_score != null ? Number(ai4i.risk_score).toFixed(1) : 'N/A'],
                  ['status', String(ai4i.status ?? 'N/A')],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="font-mono text-[10px] text-[#8c90a1]">{k}</span>
                    <span className="font-mono text-[10px] text-[#b3c5ff]">{v}</span>
                  </div>
                ))}
              </div>
            ) : <p className="font-mono text-xs text-[#424656]">No data</p>}
          </div>

          {/* SWAT Result */}
          <div className="bg-[#272a33] border border-[#424656] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">SWAT — SCADA</p>
            {/* swat.status is the risk indicator */}
              {swat?.status && <StatusBadge level={(swat.status as 'normal')} size="sm" />}
            </div>
            {swat ? (
              <div className="space-y-1">
                {([
                  // CORRECT: anomaly_probability not anomaly_score
                  ['status', String(swat.status ?? 'N/A')],
                  ['anomaly_probability', swat.anomaly_probability != null ? `${(Number(swat.anomaly_probability) * 100).toFixed(2)}%` : 'N/A'],
                  ['risk_score', swat.risk_score != null ? Number(swat.risk_score).toFixed(1) : 'N/A'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="font-mono text-[10px] text-[#8c90a1]">{k}</span>
                    <span className="font-mono text-[10px] text-[#b3c5ff]">{v}</span>
                  </div>
                ))}
              </div>
            ) : <p className="font-mono text-xs text-[#424656]">No data</p>}
          </div>

          {/* PPE Result */}
          <div className="bg-[#272a33] border border-[#424656] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">PPE — Vision</p>
            {/* ppe.status is the risk indicator */}
              {ppe?.status && <StatusBadge level={(ppe.status as 'normal')} size="sm" />}
            </div>
            {ppe ? (
              <div className="space-y-1">
                {([
                  // CORRECT: workers not workers_detected, violations not violation_count
                  ['workers', String(ppe.workers ?? 'N/A')],
                  ['violations', String(ppe.violations ?? 0)],
                  ['status', String(ppe.status ?? 'N/A')],
                  ['risk_score', ppe.risk_score != null ? Number(ppe.risk_score).toFixed(1) : 'N/A'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="font-mono text-[10px] text-[#8c90a1]">{k}</span>
                    <span className="font-mono text-[10px] text-[#b3c5ff]">{v}</span>
                  </div>
                ))}
              </div>
            ) : <p className="font-mono text-xs text-[#424656]">No data</p>}
          </div>

          {/* Fusion Result */}
          <div className="bg-[#272a33] border border-[#424656] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">Fusion</p>
            {/* fusion_output from zone: may have risk_level; direct fusion has status */}
              {(fusion?.raw?.risk_level || fusion?.status) && (
                <StatusBadge level={(fusion.raw?.risk_level?.toLowerCase() as 'normal') || (fusion.status as 'normal') || 'unknown'} size="sm" />
              )}
            </div>
            {fusion ? (
              <div className="space-y-1">
                {([
                  // CORRECT: critical_probability not confidence, status not fusion_status
                  ['status', String(fusion.status ?? fusion.raw?.risk_level ?? 'N/A')],
                  ['critical_prob', fusion.critical_probability != null ? `${(Number(fusion.critical_probability) * 100).toFixed(2)}%` : 'N/A'],
                  ['compound_risk', fusion.compound_risk != null ? Number(fusion.compound_risk).toFixed(1) : 'N/A'],
                  ['is_critical', String(fusion.is_critical ?? 'N/A')],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="font-mono text-[10px] text-[#8c90a1]">{k}</span>
                    <span className="font-mono text-[10px] text-[#b3c5ff]">{v}</span>
                  </div>
                ))}
              </div>
            ) : <p className="font-mono text-xs text-[#424656]">No data</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'explainability',
      label: 'Explainability',
      children: (
        <div className="p-4 space-y-4">
          {shapLoading ? <LoadingSkeleton variant="chart" /> : (
            fusionExplain?.feature_contributions?.length ? (
              <div>
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-[#8c90a1] mb-4">
                  SHAP Feature Contributions — {selectedZone}
                </p>
                <ShapContributionChart contributors={fusionExplain.feature_contributions} height={320} />
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {Object.entries(fusionExplain.groups || {}).map(([group, items]) => (
                    <div key={group} className="bg-[#272a33] border border-[#424656] p-3">
                      <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-2">{group}</p>
                      {(items as { feature: string; shap_contribution: number }[]).map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px] font-mono">
                          <span className="text-[#c2c6d8] truncate">{item.feature}</span>
                          <span className={item.shap_contribution >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}>
                            {item.shap_contribution.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : <Empty description="No SHAP data available. Run Fusion for this zone first." className="py-8" />
          )}
        </div>
      ),
    },
    {
      key: 'context',
      label: 'Operational Context',
      children: (
        <div className="p-4 space-y-4">
          <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-3">Runtime Zone Snapshot</p>
          {runtimeState?.zones?.[selectedZone] ? (
            <pre className="bg-[#0b0e16] border border-[#424656] p-4 text-[10px] font-mono text-[#b3c5ff] overflow-auto max-h-96 rounded">
              {JSON.stringify(runtimeState.zones[selectedZone], null, 2)}
            </pre>
          ) : <Empty description="No runtime data for this zone" className="py-8" />}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[rgba(179,197,255,0.15)] border border-[#b3c5ff] flex items-center justify-center">
            <Brain size={18} className="text-[#b3c5ff]" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">AI Insights</h2>
            <p className="font-sans text-xs text-[#8c90a1]">Module analytics, explainability, SHAP, and operational context</p>
          </div>
        </div>
        <Select
          value={selectedZone}
          onChange={setSelectedZone}
          options={ZONES.map((z) => ({ value: z, label: z.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))}
          style={{ width: 200 }}
        />
      </div>

      {/* Zone summary */}
      {zone && !zoneLoading && (
        <div className="flex items-center gap-4 bg-[#191b24] border border-[#424656] p-4">
          <h3 className="font-display font-semibold text-lg text-[#e1e2ee]">{zone.zone_name || selectedZone}</h3>
          <StatusBadge level={zone.risk_level} size="md" pulse />
          <span className="font-mono text-xs text-[#8c90a1]">Fusion: {zone.fusion_status || 'N/A'}</span>
        </div>
      )}

      {/* Tabs */}
      <ErrorBoundary moduleName="AI Insights">
        <div className="bg-[#191b24] border border-[#424656]">
          <Tabs items={tabItems} tabBarStyle={{ paddingLeft: 16, borderBottom: '1px solid #424656' }} />
        </div>
      </ErrorBoundary>
    </div>
  )
}
