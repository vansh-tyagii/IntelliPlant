import React, { useState } from 'react'
import { Drawer, Tabs, Button, Spin, Empty, Table } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { plantService } from '@/services/plantService'
import { ragService, incidentService } from '@/services/ragService'
import { StatusBadge, getRiskColor } from '@/components/ui/StatusBadge'
import { ShapContributionChart } from '@/components/charts/ShapContributionChart'
import { ExportModal } from '@/features/export/ExportModal'
import { RagReferenceCard } from '@/features/compliance/RagReferenceCard'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { FileText, Activity, Eye, Cpu, Shield, Clock, AlertTriangle } from 'lucide-react'
import type { TimelineEvent } from '@/types/api'

interface ZoneInspectionDrawerProps {
  zoneId: string | null
  open: boolean
  onClose: () => void
}

export const ZoneInspectionDrawer: React.FC<ZoneInspectionDrawerProps> = ({ zoneId, open, onClose }) => {
  const [exportOpen, setExportOpen] = useState(false)
  const [exportData, setExportData] = useState<unknown>(null)

  const { data: zone, isLoading: zoneLoading } = useQuery({
    queryKey: ['zone-detail', zoneId],
    queryFn: () => plantService.getZone(zoneId!),
    enabled: !!zoneId && open,
    staleTime: 10000,
  })

  const { data: fusionExplain } = useQuery({
    queryKey: ['fusion-explain', zoneId],
    queryFn: () => ragService.getFusionExplain(zoneId!),
    enabled: !!zoneId && open,
    retry: 1,
  })

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', zoneId],
    queryFn: () => ragService.getRecommendations(zoneId!),
    enabled: !!zoneId && open,
    retry: 1,
  })

  const { data: timeline } = useQuery({
    queryKey: ['zone-timeline', zoneId],
    queryFn: () => plantService.getZoneTimeline(zoneId!),
    enabled: !!zoneId && open,
  })

  const { data: incidents } = useQuery({
    queryKey: ['incidents-drawer'],
    queryFn: () => incidentService.getIncidents(10),
    enabled: open,
  })

  const generateIncident = useMutation({
    mutationFn: () => incidentService.generateIncident(zoneId!),
    onSuccess: (data) => { setExportData(data); setExportOpen(true) },
  })

  const zoneIncidents = (incidents?.incidents || []).filter(
    (inc) => inc.zone === zoneId || inc.affected_zone === zoneId
  )

  const ai4i = zone?.latest_ai4i_output
  const swat = zone?.latest_swat_output
  const ppe = zone?.latest_ppe_output
  const fusion = zone?.fusion_output

  const swatSensorColumns = [
    { title: 'Sensor', dataIndex: 'key', key: 'key', width: 120, render: (v: string) => <span className="font-mono text-xs text-[#c2c6d8]">{v}</span> },
    { title: 'Value', dataIndex: 'value', key: 'value', render: (v: unknown) => <span className="font-mono text-xs text-[#b3c5ff]">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span> },
  ]

  // Only show actual scalar/string values — filter out nested objects like 'raw'
  const swatSensorData = swat
    ? Object.entries(swat)
        .filter(([k, v]) => !['raw', 'agent', 'fusion_features'].includes(k) && typeof v !== 'object')
        .map(([key, value]) => ({ key, value, _key: key }))
    : []

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      icon: <Shield size={13} />,
      children: zoneLoading ? <div className="flex justify-center p-8"><Spin /></div> : (
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-semibold text-lg text-[#e1e2ee]">{zone?.zone_name || zoneId}</h3>
            <StatusBadge level={zone?.risk_level || 'unknown'} pulse size="md" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Fusion Status', value: zone?.fusion_status || 'N/A' },
              { label: 'Last Update', value: zone?.last_update ? new Date(zone.last_update).toLocaleTimeString('en-IN', { hour12: false }) : 'N/A' },
              { label: 'Area Type', value: zone?.metadata?.area_type || 'N/A' },
              { label: 'Floor', value: zone?.metadata?.floor || 'N/A' },
            ].map((item) => (
              <div key={item.label} className="bg-[#272a33] p-3 border border-[#424656]">
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{item.label}</p>
                <p className="font-mono text-sm text-[#e1e2ee]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'machine',
      label: 'Machine',
      icon: <Cpu size={13} />,
      children: (
        <div className="p-4 space-y-3">
          {ai4i ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Prediction', value: String(ai4i.prediction ?? 'N/A') },
                  { label: 'Failure Type', value: String(ai4i.failure_type ?? 'None') },
                  { label: 'Confidence', value: ai4i.confidence ? `${(Number(ai4i.confidence) * 100).toFixed(1)}%` : 'N/A' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#272a33] p-3 border border-[#424656]">
                    <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="font-mono text-sm text-[#e1e2ee]">{item.value}</p>
                  </div>
                ))}
              </div>
              {/* ai4i.status is the risk indicator (not ai4i.risk_level) */}
              <StatusBadge level={(ai4i.status as 'normal') || 'unknown'} size="md" />
            </>
          ) : <Empty description="No AI4I data available for this zone" className="py-8" />}
        </div>
      ),
    },
    {
      key: 'sensor',
      label: 'Sensor',
      icon: <Activity size={13} />,
      children: (
        <div className="p-4 space-y-3">
          {swat ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Status', value: String(swat.status || 'N/A') },
                  // CORRECT field name: anomaly_probability (not anomaly_score)
                  { label: 'Anomaly Probability', value: swat.anomaly_probability != null ? `${(Number(swat.anomaly_probability) * 100).toFixed(2)}%` : 'N/A' },
                  { label: 'Risk Score', value: swat.risk_score != null ? Number(swat.risk_score).toFixed(1) : 'N/A' },
                  { label: 'Recon Error', value: swat.raw?.reconstruction_error != null ? Number(swat.raw?.reconstruction_error).toFixed(6) : 'N/A' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#272a33] p-3 border border-[#424656]">
                    <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="font-mono text-sm text-[#e1e2ee]">{item.value}</p>
                  </div>
                ))}
              </div>
              {swatSensorData.length > 0 && (
                <Table
                  dataSource={swatSensorData}
                  columns={swatSensorColumns}
                  rowKey="_key"
                  size="small"
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ y: 200 }}
                />
              )}
            </>
          ) : <Empty description="No SWAT data available for this zone" className="py-8" />}
        </div>
      ),
    },
    {
      key: 'worker',
      label: 'Workers',
      icon: <Eye size={13} />,
      children: (
        <div className="p-4 space-y-3">
          {ppe ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                // CORRECT field names from real backend: workers (not workers_detected), violations (not violation_count)
                { label: 'Workers Detected', value: String(ppe.workers ?? ppe.raw?.workers_detected ?? 'N/A') },
                { label: 'Violations', value: String(ppe.violations ?? 0) },
                { label: 'Status', value: String(ppe.status || 'N/A') },
                { label: 'Risk Score', value: ppe.risk_score != null ? Number(ppe.risk_score).toFixed(1) : 'N/A' },
              ].map((item) => (
                <div key={item.label} className="bg-[#272a33] p-3 border border-[#424656] col-span-1">
                  <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="font-mono text-sm text-[#e1e2ee]">{item.value}</p>
                </div>
              ))}
              {/* PPE detected — show from raw.ppe_detected if available */}
              {Array.isArray(ppe.raw?.ppe_detected) && ppe.raw!.ppe_detected!.length > 0 && (
                <div className="col-span-2 bg-[#272a33] p-3 border border-[#424656]">
                  <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-2">PPE Detected</p>
                  <div className="flex flex-wrap gap-1">
                    {(ppe.raw?.ppe_detected as string[]).map((item, i) => (
                      <span key={i} className="font-mono text-[10px] bg-[rgba(34,197,94,0.15)] text-[#22c55e] border border-[#22c55e] px-2 py-0.5 rounded">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <Empty description="No PPE data available for this zone" className="py-8" />}
        </div>
      ),
    },
    {
      key: 'fusion',
      label: 'Fusion',
      icon: <Shield size={13} />,
      children: (
        <div className="p-4 space-y-4">
          {fusion ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  // fusion_output from zone detail may have risk_level (twin field)
                  // Direct fusion results use status + critical_probability
                  { label: 'Risk Status', value: <StatusBadge level={(fusion.raw?.risk_level?.toLowerCase() as 'normal') || (fusion.risk_level as 'normal') || (fusion.status as 'normal') || 'unknown'} size="md" /> },
                  { label: 'Critical Probability', value: fusion.critical_probability != null ? `${(Number(fusion.critical_probability) * 100).toFixed(2)}%` : (fusion.confidence != null ? `${(Number(fusion.confidence) * 100).toFixed(1)}%` : 'N/A') },
                  { label: 'Compound Risk', value: fusion.compound_risk != null ? Number(fusion.compound_risk).toFixed(1) : 'N/A' },
                  { label: 'Is Critical', value: fusion.is_critical != null ? String(fusion.is_critical) : 'N/A' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#272a33] p-3 border border-[#424656]">
                    <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{item.label}</p>
                    <div className="font-mono text-sm text-[#e1e2ee]">{item.value}</div>
                  </div>
                ))}
              </div>
              {/* explanation field comes from twin/RAG, not direct fusion result */}
              {(fusion.explanation || fusion.raw?.risk_level) && (
                <div className="bg-[#272a33] p-3 border border-[#424656]">
                  <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-2">Decision Context</p>
                  <p className="font-sans text-sm text-[#c2c6d8] leading-relaxed">
                    {fusion.explanation || `Risk Level: ${fusion.raw?.risk_level} (Critical Threshold: ${fusion.raw?.decision_threshold ?? '0.05'})`}
                  </p>
                </div>
              )}
              <ErrorBoundary moduleName="SHAP Chart">
                {fusionExplain?.feature_contributions?.length ? (
                  <div>
                    <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-2">SHAP Contributions</p>
                    <ShapContributionChart contributors={fusionExplain.feature_contributions} height={200} />
                  </div>
                ) : null}
              </ErrorBoundary>
            </>
          ) : <Empty description="No Fusion data available. Run fusion for this zone." className="py-8" />}
        </div>
      ),
    },
    {
      key: 'recommendation',
      label: 'Recommendation',
      icon: <Shield size={13} />,
      children: (
        <div className="p-4 space-y-3">
          {recommendations ? (
            <>
              <div className="bg-[#272a33] p-4 border border-[#f59e0b] border-l-4">
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">Immediate Action</p>
                <p className="font-sans text-sm text-[#e1e2ee] leading-relaxed">{recommendations.immediate_action}</p>
              </div>
              <div className="bg-[#272a33] p-4 border border-[#424656]">
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">Emergency Action</p>
                <p className="font-sans text-sm text-[#c2c6d8] leading-relaxed">{recommendations.emergency_action}</p>
              </div>
              {recommendations.oisd && <RagReferenceCard source="OISD" excerpt={recommendations.oisd} />}
              {recommendations.factory_act && <RagReferenceCard source="Factories Act" excerpt={recommendations.factory_act} />}
              {recommendations.dgms && <RagReferenceCard source="DGMS" excerpt={recommendations.dgms} />}
            </>
          ) : <Empty description="No recommendation available" className="py-8" />}
        </div>
      ),
    },
    {
      key: 'timeline',
      label: 'Timeline',
      icon: <Clock size={13} />,
      children: (
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {(timeline?.timeline || []).length > 0 ? timeline?.timeline.map((event: TimelineEvent, i: number) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: getRiskColor(event.risk_level || 'unknown') }} />
                {i < (timeline?.timeline?.length || 0) - 1 && <div className="w-px flex-1 bg-[#272a33] my-1" />}
              </div>
              <div className="pb-3">
                <p className="font-sans text-sm text-[#e1e2ee]">{event.message || event.description || 'Event'}</p>
                <p className="font-mono text-[10px] text-[#8c90a1] mt-0.5">
                  {event.source} · {event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-IN', { hour12: false }) : 'N/A'}
                </p>
              </div>
            </div>
          )) : <Empty description="No timeline events for this zone" className="py-8" />}
        </div>
      ),
    },
    {
      key: 'incidents',
      label: 'Incidents',
      icon: <AlertTriangle size={13} />,
      children: (
        <div className="p-4 space-y-3">
          {zoneIncidents.length > 0 ? zoneIncidents.map((inc, i) => (
            <div key={i} className="border-l-4 p-3 bg-[#272a33]" style={{ borderLeftColor: getRiskColor(inc.risk_level || 'unknown') }}>
              <div className="flex items-start justify-between">
                <StatusBadge level={inc.risk_level || 'unknown'} size="sm" />
                <span className="font-mono text-[10px] text-[#8c90a1]">
                  {inc.timestamp ? new Date(inc.timestamp).toLocaleString('en-IN') : ''}
                </span>
              </div>
              <p className="font-sans text-sm text-[#e1e2ee] mt-2">{inc.summary}</p>
              {inc.recommendation && (
                <p className="font-sans text-xs text-[#8c90a1] mt-1">{inc.recommendation}</p>
              )}
            </div>
          )) : <Empty description="No incidents for this zone" className="py-8" />}
        </div>
      ),
    },
  ]

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={540}
        placement="right"
        title={
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-[#e1e2ee]">{zone?.zone_name || zoneId}</span>
              {zone && <StatusBadge level={zone.risk_level} size="sm" />}
            </div>
            <Button
              type="primary"
              size="small"
              icon={<FileText size={12} />}
              loading={generateIncident.isPending}
              onClick={() => generateIncident.mutate()}
            >
              Generate Report
            </Button>
          </div>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          items={tabItems.map((tab) => ({
            ...tab,
            label: (
              <span className="flex items-center gap-1.5 text-xs">
                {tab.icon} {tab.label}
              </span>
            ),
          }))}
          tabBarStyle={{ margin: 0, paddingLeft: 12, borderBottom: '1px solid #424656' }}
          tabBarGutter={4}
          size="small"
        />
      </Drawer>

      {exportData && (
        <ExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          data={exportData}
          title="Zone Incident Report"
          filename={`incident-${zoneId}-${Date.now()}`}
        />
      )}
    </>
  )
}
