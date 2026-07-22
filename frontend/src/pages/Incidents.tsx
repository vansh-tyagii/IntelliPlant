import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Select, Empty } from 'antd'
import { AlertTriangle, FileText, Download } from 'lucide-react'
import { incidentService } from '@/services/ragService'
import { StatusBadge, getRiskColor } from '@/components/ui/StatusBadge'
import { ExportModal } from '@/features/export/ExportModal'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

const ZONES = ['all', 'boiler-room', 'machine-hall', 'control-room', 'assembly-line', 'warehouse', 'maintenance', 'packing', 'chemical-storage', 'loading-bay', 'utility-area']

export const Incidents: React.FC = () => {
  const [filterZone, setFilterZone] = useState('all')
  const [selectedIncident, setSelectedIncident] = useState<unknown>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentService.getIncidents(50),
  })

  const generateMutation = useMutation({
    mutationFn: (zone: string) => incidentService.generateIncident(zone),
    onSuccess: () => refetch(),
  })

  // Backend incidents use: zone, timestamp_utc, root_cause, compound_risk_score
  const incidents = (data?.incidents || []).filter((inc) =>
    filterZone === 'all' || inc.zone === filterZone || inc.zone_id === filterZone || inc.affected_zone === filterZone
  )

  if (isLoading) return <div className="p-6"><LoadingSkeleton variant="row" count={5} /></div>

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[rgba(239,68,68,0.15)] border border-[#ef4444] flex items-center justify-center">
            <AlertTriangle size={18} className="text-[#ef4444]" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">Incident Intelligence</h2>
            <p className="font-sans text-xs text-[#8c90a1]">{incidents.length} incidents · AI-generated summaries and recommendations</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Select
            value={filterZone}
            onChange={setFilterZone}
            options={ZONES.map((z) => ({ value: z, label: z === 'all' ? 'All Zones' : z.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))}
            style={{ width: 180 }}
          />
        </div>
      </div>

      {/* Incidents list */}
      {incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Empty description="No incidents found" />
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident, i) => (
            <div key={incident.incident_id || i}
              className="bg-[#191b24] border border-[#424656] overflow-hidden hover:border-[#8c90a1] transition-colors fade-in"
              style={{ borderLeftWidth: 4, borderLeftColor: getRiskColor(incident.risk_level || 'unknown') }}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge level={incident.risk_level || 'unknown'} size="sm" />
                      <span className="font-mono text-[10px] text-[#8c90a1]">
                        {incident.zone || incident.zone_id || incident.affected_zone} ·{' '}
                        {/* Backend uses timestamp_utc; fall back to timestamp */}
                        {(incident.timestamp_utc || incident.timestamp)
                          ? new Date(incident.timestamp_utc || incident.timestamp!).toLocaleString('en-IN')
                          : 'N/A'}
                      </span>
                    </div>
                    {/* root_cause is the real field; fall back to summary */}
                    <p className="font-sans text-sm font-semibold text-[#e1e2ee] mb-2">
                      {incident.root_cause || incident.summary || 'No summary available.'}
                    </p>
                    {/* machine_status as extra context */}
                    {incident.machine_status && incident.machine_status !== 'No Failure' && (
                      <p className="font-sans text-xs text-[#f59e0b] mb-1">Machine: {incident.machine_status}</p>
                    )}
                    {/* compound_risk_score is real field */}
                    {incident.compound_risk_score != null && (
                      <p className="font-mono text-[10px] text-[#8c90a1] mb-1">
                        Compound Risk: {Number(incident.compound_risk_score).toFixed(1)}
                        {incident.confidence != null && ` · Confidence: ${(Number(incident.confidence) * 100).toFixed(1)}%`}
                        {incident.workers != null && ` · Workers: ${incident.workers}`}
                      </p>
                    )}
                    {incident.recommendation && (
                      <p className="font-sans text-xs text-[#8c90a1] leading-relaxed">{incident.recommendation}</p>
                    )}
                    {/* contributing_modules not in /api/incidents — show top_contributors */}
                    {(incident.top_contributors || incident.contributing_modules || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(incident.top_contributors || incident.contributing_modules)!.map((item: unknown, j: number) => {
                          const label = typeof item === 'string' ? item : (item as { feature?: string })?.feature || String(item)
                          return (
                            <span key={j} className="font-mono text-[9px] px-1.5 py-0.5 bg-[#272a33] border border-[#424656] text-[#b3c5ff] rounded">{label}</span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="small"
                      icon={<FileText size={12} />}
                      onClick={() => { setSelectedIncident(incident); setExportOpen(true) }}
                    >
                      Export
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        data={selectedIncident}
        title="Incident Report"
        filename={`incident-${Date.now()}`}
      />
    </div>
  )
}
