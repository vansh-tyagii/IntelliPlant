import React, { useEffect, useState } from 'react'
import { Collapse, Button, Select, InputNumber, Table, Upload } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ChevronDown, Play, Wand2, Settings2 } from 'lucide-react'
import { aiModelsService } from '@/services/aiModelsService'
import { scenarioService } from '@/services/scenarioService'
import { liveService, uploadService } from '@/services/liveService'
import { useAppStore } from '@/store/appStore'
import { useDemoStore } from '@/store/demoStore'
import { useRuntimeStore } from '@/store/runtimeStore'
import { DemoWizard } from '@/features/demo/DemoWizard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { RcFile } from 'antd/es/upload'

const ZONES = [
  'boiler-room', 'machine-hall', 'control-room', 'assembly-line', 'warehouse',
  'maintenance', 'packing', 'chemical-storage', 'loading-bay', 'utility-area',
]

export const Operations: React.FC = () => {
  const { mode, setMode } = useAppStore()
  const { selectedZone, setSelectedZone, setWizardOpen, ai4iInput, setAi4iInput } = useDemoStore()
  const { ai4iResults, swatResults, ppeResults, fusionResults, updateAi4i, updateSwat, updatePpe, updateFusion } = useRuntimeStore()
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPath, setVideoPath] = useState<string>('')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('')
  const [swatCurrent, setSwatCurrent] = useState<Record<string, number>>({})
  const [fusionContext, setFusionContext] = useState({
    permit_conflict_score: 0, shift_context_score: 0, permit_type: 'NONE',
    permit_active: 0, maintenance_active: 0, isolation_verified: 0,
    workers_in_zone: 0, supervisor_present: 1, shift_change_flag: 0,
  })

  const { data: swatDefaults } = useQuery({
    queryKey: ['swat-current-reading'],
    queryFn: () => aiModelsService.getSWATReadings(1, 14),
    staleTime: Infinity,
  })

  useEffect(() => {
    if (swatDefaults?.readings[0] && Object.keys(swatCurrent).length === 0) {
      setSwatCurrent(swatDefaults.readings[0])
    }
  }, [swatDefaults, swatCurrent])

  // Demo mutations
  const ai4iMutation = useMutation({
    mutationFn: () => aiModelsService.predictAi4i(ai4iInput!, selectedZone),
    onSuccess: (data) => { const r = data?.results?.ai4i; if (r) updateAi4i(selectedZone, r) },
  })

  // The model needs 15 consecutive raw readings: 14 dataset history rows + this user-entered row.
  const swatMutation = useMutation({
    mutationFn: async () => {
      const history = await aiModelsService.getSWATReadings(14, 0)
      if (!history.readings || history.readings.length < 14 || Object.keys(swatCurrent).length === 0) throw new Error('Enter the current SWaT sensor values before analysis.')
      return aiModelsService.analyzeSwat({ zone: selectedZone, history: [...history.readings, swatCurrent] })
    },
    onSuccess: (data) => { const r = data?.results?.swat; if (r) updateSwat(selectedZone, r) },
  })

  const ppeMutation = useMutation({
    mutationFn: () => {
      if (!videoPath) throw new Error('Upload an image or video before running PPE analysis.')
      return aiModelsService.analyzePpe({ zone: selectedZone, video_path: videoPath })
    },
    onSuccess: (data) => { const r = data?.results?.ppe; if (r) updatePpe(selectedZone, r) },
  })

  const fusionMutation = useMutation({
    mutationFn: () => aiModelsService.analyzeFusion({
      zone: selectedZone,
      upstream: { ai4i: ai4iResults[selectedZone], swat: swatResults[selectedZone], ppe: ppeResults[selectedZone] },
      operational_context: fusionContext,
    }),
    onSuccess: (data) => { const r = data?.results?.fusion; if (r) updateFusion(selectedZone, r) },
  })

  const startLiveMutation = useMutation({
    mutationFn: () => liveService.startAllLive({ interval_seconds: 3 }),
    onSuccess: () => setMode('live'),
  })

  const { data: scenariosData } = useQuery({
    queryKey: ['scenarios-ops'],
    queryFn: scenarioService.getScenarios,
    staleTime: 30000,
  })

  const ai4iResult = ai4iResults[selectedZone]
  const swatResult = swatResults[selectedZone]
  const ppeResult = ppeResults[selectedZone]
  const fusionResult = fusionResults[selectedZone]

  const swatColumns = [
    { title: 'Key', dataIndex: 'k', key: 'k', render: (v: string) => <span className="font-mono text-xs text-[#c2c6d8]">{v}</span> },
    { title: 'Value', dataIndex: 'v', key: 'v', render: (v: unknown) => <span className="font-mono text-xs text-[#b3c5ff]">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span> },
  ]

  const demoPanels = [
    {
      key: 'ai4i',
      label: (
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-[9px]">①</span>
          <span className="font-display font-semibold text-[#e1e2ee]">Machine Intelligence — AI4I</span>
          {ai4iResult && (
            // Render using actual status field (not risk_level which doesn't exist at top level)
            <StatusBadge level={(ai4iResult.status as 'normal') || 'unknown'} size="sm" />
          )}
        </div>
      ),
      children: (
        <div className="grid grid-cols-2 gap-4 p-4">
          <div className="space-y-3">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">Input Parameters</p>
            {[
              { label: 'Air Temp (K)', key: 'air_temp' as const, step: 0.1 },
              { label: 'Process Temp (K)', key: 'process_temp' as const, step: 0.1 },
              { label: 'RPM', key: 'rpm' as const, step: 10 },
              { label: 'Torque (Nm)', key: 'torque' as const, step: 0.1 },
              { label: 'Tool Wear (min)', key: 'tool_wear' as const, step: 1 },
            ].map(({ label, key, step }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <p className="font-sans text-xs text-[#c2c6d8] whitespace-nowrap">{label}</p>
                <InputNumber
                  value={ai4iInput?.[key]}
                  onChange={(v) => setAi4iInput({ ...ai4iInput!, [key]: v ?? 0 })}
                  step={step}
                  style={{ width: 120 }}
                  size="small"
                />
              </div>
            ))}
            <Select
              value={ai4iInput?.machine_type}
              onChange={(v) => setAi4iInput({ ...ai4iInput!, machine_type: v })}
              options={[{ value: 'L', label: 'Light' }, { value: 'M', label: 'Medium' }, { value: 'H', label: 'Heavy' }]}
              style={{ width: '100%' }}
              size="small"
              placeholder="Machine Type"
            />
            <Button type="primary" block loading={ai4iMutation.isPending} onClick={() => ai4iMutation.mutate()}>
              <Play size={12} /> Predict
            </Button>
          </div>
          <div className="space-y-3">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">Result</p>
            {ai4iResult ? (
              <div className="space-y-2">
                {([
                  { k: 'Status', v: ai4iResult.status },
                  { k: 'Prediction', v: ai4iResult.prediction },
                  { k: 'Failure Type', v: ai4iResult.failure_type },
                  { k: 'Confidence', v: ai4iResult.confidence != null ? `${(Number(ai4iResult.confidence) * 100).toFixed(1)}%` : 'N/A' },
                  { k: 'Risk Score', v: ai4iResult.risk_score != null ? Number(ai4iResult.risk_score).toFixed(1) : 'N/A' },
                  { k: 'Reason', v: ai4iResult.reason },
                ] as { k: string; v: unknown }[]).map(({ k, v }) => (
                  <div key={k} className="flex justify-between border-b border-[#272a33] py-1">
                    <span className="font-mono text-[10px] text-[#8c90a1]">{k}</span>
                    <span className="font-mono text-[10px] text-[#b3c5ff]">{String(v ?? '--')}</span>
                  </div>
                ))}
              </div>
            ) : <p className="font-mono text-xs text-[#424656]">— Run prediction to see results —</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'swat',
      label: (
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-[9px]">②</span>
          <span className="font-display font-semibold text-[#e1e2ee]">SCADA Intelligence — SWAT</span>
          {swatResult && (
            <StatusBadge level={(swatResult.status as 'normal') || 'unknown'} size="sm" />
          )}
        </div>
      ),
      children: (
        <div className="p-4 space-y-4">
          <p className="font-sans text-sm text-[#c2c6d8]">
            Enter the current SWaT sensor reading. The previous 14 readings are taken from the dataset as the model's required history.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
            {Object.entries(swatCurrent).map(([sensor, value]) => (
              <label key={sensor} className="bg-[#272a33] border border-[#424656] p-2">
                <span className="block font-mono text-[9px] text-[#8c90a1] mb-1">{sensor}</span>
                <InputNumber size="small" value={value} onChange={(v) => setSwatCurrent((current) => ({ ...current, [sensor]: Number(v ?? 0) }))} style={{ width: '100%' }} />
              </label>
            ))}
          </div>
          {!Object.keys(swatCurrent).length && <p className="font-mono text-xs text-[#8c90a1]">Loading the sensor template…</p>}
          {swatMutation.isError && (
            <p className="font-mono text-xs text-[#ef4444]">{String((swatMutation.error as Error)?.message)}</p>
          )}
          <Button type="primary" loading={swatMutation.isPending} onClick={() => swatMutation.mutate()}>
            <Play size={12} /> Analyze SCADA
          </Button>
          {swatResult && (
            <Table
              dataSource={[
                { _k: 'status', k: 'Status', v: swatResult.status },
                { _k: 'anomaly_probability', k: 'Anomaly Probability', v: swatResult.anomaly_probability != null ? `${(Number(swatResult.anomaly_probability) * 100).toFixed(2)}%` : 'N/A' },
                { _k: 'risk_score', k: 'Risk Score', v: swatResult.risk_score != null ? Number(swatResult.risk_score).toFixed(1) : 'N/A' },
                { _k: 'reason', k: 'Reason', v: swatResult.reason },
                { _k: 'recon_error', k: 'Reconstruction Error', v: swatResult.raw?.reconstruction_error != null ? Number(swatResult.raw?.reconstruction_error).toFixed(6) : 'N/A' },
                { _k: 'threshold_95', k: 'Threshold 95%', v: swatResult.raw?.threshold_95 != null ? Number(swatResult.raw?.threshold_95).toFixed(6) : 'N/A' },
              ]}
              columns={swatColumns}
              rowKey="_k"
              size="small"
              pagination={false}
            />
          )}
        </div>
      ),
    },
    {
      key: 'ppe',
      label: (
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-[9px]">③</span>
          <span className="font-display font-semibold text-[#e1e2ee]">Vision Intelligence — PPE</span>
          {ppeResult && (
            <StatusBadge level={(ppeResult.status as 'normal') || 'normal'} size="sm" />
          )}
        </div>
      ),
      children: (
        <div className="p-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Upload.Dragger
                accept="image/*,video/*"
                beforeUpload={async (file: RcFile) => {
                  const res = await uploadService.uploadVideo(file)
                  setVideoPath(res.video_path)
                  setVideoFile(file)
                  setVideoPreviewUrl(URL.createObjectURL(file))
                  return false
                }}
                maxCount={1}
              >
                <p className="font-sans text-sm text-[#c2c6d8]">Upload video / image for PPE detection</p>
              </Upload.Dragger>
              <Button type="primary" loading={ppeMutation.isPending} disabled={!videoPath} onClick={() => ppeMutation.mutate()}>
                <Play size={12} /> Analyze PPE
              </Button>
            </div>
            {videoPreviewUrl && (
              <div className="bg-[#11131a] border border-[#424656] p-2">
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-2">{ppeMutation.isPending ? 'Analysing input video' : 'Uploaded video'}</p>
                {videoFile?.type.startsWith('image/') ? <img src={videoPreviewUrl} className="w-full max-h-64 object-contain" /> : <video src={videoPreviewUrl} controls autoPlay muted className="w-full max-h-64 bg-black" />}
              </div>
            )}
          </div>
          {ppeResult?.raw?.detected_media_url && (
            <div className="bg-[#11131a] border border-[#0066ff] p-2">
              <p className="font-mono text-[9px] text-[#b3c5ff] uppercase mb-2">Detected PPE video</p>
              <video src={String(ppeResult.raw.detected_media_url)} controls autoPlay className="w-full max-h-[420px] bg-black" />
            </div>
          )}
          {ppeResult && (
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Workers', value: ppeResult.workers },          // correct field
                { label: 'Violations', value: ppeResult.violations },    // correct field
                { label: 'Risk Score', value: ppeResult.risk_score != null ? Number(ppeResult.risk_score).toFixed(1) : '--' },
                { label: 'Status', value: ppeResult.status },
                { label: 'Reason', value: ppeResult.reason },
                { label: 'Frames Analyzed', value: ppeResult.raw?.analyzed_frames },
                { label: 'Max People', value: ppeResult.raw?.maximum_people_detected },
                { label: 'Average People', value: ppeResult.raw?.average_people_detected },
                { label: 'Average Compliance', value: ppeResult.raw?.average_ppe_compliance != null ? `${(ppeResult.raw.average_ppe_compliance * 100).toFixed(1)}%` : undefined },
                { label: 'Detected PPE', value: ppeResult.raw?.detected_ppe_items?.join(', ') },
                { label: 'PPE Classes', value: ppeResult.raw?.class_counts ? Object.entries(ppeResult.raw.class_counts as Record<string, number>).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ') : '--' },
              ] as { label: string; value: unknown }[]).map((item) => (
                <div key={item.label} className="bg-[#272a33] p-2 border border-[#424656]">
                  <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-1">{item.label}</p>
                  <p className="font-mono text-xs text-[#e1e2ee]">{String(item.value ?? '--')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'fusion',
      label: (
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-[9px]">④</span>
          <span className="font-display font-semibold text-[#e1e2ee]">Fusion Analysis</span>
          {fusionResult && (
            // Use status field (backend) not risk_level (twin field, may not exist here)
            <StatusBadge level={(fusionResult.raw?.risk_level?.toLowerCase() as 'normal') || (fusionResult.status as 'normal') || 'unknown'} size="sm" />
          )}
        </div>
      ),
      children: (
        <div className="p-4 space-y-4">
          <p className="font-sans text-sm text-[#c2c6d8]">
            AI4I, SWaT, and PPE values come from completed model outputs. Enter the operational context required by the fusion model below.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              ['permit_conflict_score', 'Permit conflict score', 0.01], ['shift_context_score', 'Shift context score', 0.01],
              ['workers_in_zone', 'Workers in zone', 1],
            ] as const).map(([key, label, step]) => (
              <label key={key}><span className="block font-mono text-[9px] text-[#8c90a1] uppercase mb-1">{label}</span><InputNumber min={0} max={key.includes('score') ? 1 : undefined} step={step} value={fusionContext[key]} onChange={(v) => setFusionContext((c) => ({ ...c, [key]: Number(v ?? 0) }))} style={{ width: '100%' }} /></label>
            ))}
            <label><span className="block font-mono text-[9px] text-[#8c90a1] uppercase mb-1">Permit type</span><Select value={fusionContext.permit_type} onChange={(v) => setFusionContext((c) => ({ ...c, permit_type: v }))} options={['NONE', 'ELECTRICAL', 'HOT_WORK', 'CONFINED_SPACE'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} style={{ width: '100%' }} /></label>
            {([
              ['permit_active', 'Permit active'], ['maintenance_active', 'Maintenance active'], ['isolation_verified', 'Isolation verified'], ['supervisor_present', 'Supervisor present'], ['shift_change_flag', 'Shift change flag'],
            ] as const).map(([key, label]) => (
              <label key={key}><span className="block font-mono text-[9px] text-[#8c90a1] uppercase mb-1">{label}</span><Select value={fusionContext[key]} onChange={(v) => setFusionContext((c) => ({ ...c, [key]: v }))} options={[{ value: 1, label: 'Yes' }, { value: 0, label: 'No' }]} style={{ width: '100%' }} /></label>
            ))}
          </div>
          <Button type="primary" loading={fusionMutation.isPending} onClick={() => fusionMutation.mutate()}>
            🔀 Run Fusion
          </Button>
          {fusionResult && (
            <div className="space-y-2">
              {([
                { label: 'Status', value: fusionResult.status ?? fusionResult.raw?.risk_level },
                { label: 'Critical Probability', value: fusionResult.critical_probability != null ? `${(Number(fusionResult.critical_probability) * 100).toFixed(2)}%` : 'N/A' },
                { label: 'Compound Risk', value: fusionResult.compound_risk != null ? Number(fusionResult.compound_risk).toFixed(1) : 'N/A' },
                { label: 'Is Critical', value: fusionResult.is_critical != null ? String(fusionResult.is_critical) : 'N/A' },
                { label: 'Top Contributor', value: fusionResult.top_contributors?.[0]?.feature ?? 'N/A' },
              ] as { label: string; value: unknown }[]).filter((i) => i.value !== undefined && i.value !== null).map((item) => (
                <div key={item.label} className="bg-[#272a33] p-3 border border-[#424656]">
                  <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-1">{item.label}</p>
                  <p className="font-sans text-sm text-[#e1e2ee]">{String(item.value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">Operations Control</h2>
          <p className="font-sans text-xs text-[#8c90a1] mt-0.5">Demo controls, live mode, scenario playback and module orchestration</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedZone}
            onChange={setSelectedZone}
            options={ZONES.map((z) => ({ value: z, label: z.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) }))}
            style={{ width: 200 }}
            placeholder="Select zone"
          />
          {mode === 'demo' && (
            <Button
              type="primary"
              icon={<Wand2 size={14} />}
              onClick={() => setWizardOpen(true)}
              className="bg-[#9c27b0] border-[#9c27b0] hover:bg-[#7b1fa2] hover:border-[#7b1fa2]"
            >
              Start Demo Wizard
            </Button>
          )}
          {mode === 'demo' && (
            <Button onClick={() => startLiveMutation.mutate()} loading={startLiveMutation.isPending}>
              Switch to Live
            </Button>
          )}
        </div>
      </div>

      {/* Demo Controls Section (Demo mode only) */}
      {mode === 'demo' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[#424656]" />
            <span className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-widest px-3">Demo Controls — Zone: {selectedZone}</span>
            <div className="h-px flex-1 bg-[#424656]" />
          </div>
          <ErrorBoundary moduleName="Demo Panels">
            <Collapse
              items={demoPanels}
              defaultActiveKey={['ai4i']}
              bordered
              ghost={false}
              expandIcon={({ isActive }) => <ChevronDown size={14} className={`transition-transform ${isActive ? 'rotate-180' : ''}`} />}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Live mode status */}
      {mode === 'live' && (
        <div className="bg-[rgba(34,197,94,0.1)] border border-[#22c55e] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#22c55e] live-pulse" />
            <div>
              <p className="font-display font-semibold text-[#22c55e]">Live Mode Active</p>
              <p className="font-sans text-xs text-[#8c90a1]">Synchronized 3-second cycle running across all zones</p>
            </div>
          </div>
          <Button onClick={() => setMode('demo')} danger>Stop Live</Button>
        </div>
      )}

      {/* Scenarios */}
      <div className="bg-[#191b24] border border-[#424656] p-5">
        <h3 className="font-display font-semibold text-sm text-[#e1e2ee] mb-4 flex items-center gap-2">
          <Settings2 size={16} className="text-[#b3c5ff]" /> Scenario Library
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(scenariosData?.scenarios || []).map((scenario) => (
            <button
              key={scenario.scenario_id}
              onClick={() => scenarioService.loadScenario(scenario.scenario_id)}
              className="p-3 border border-[#424656] hover:border-[#b3c5ff] hover:bg-[#272a33] text-left transition-colors group"
            >
              <p className="font-sans text-xs font-semibold text-[#e1e2ee] group-hover:text-[#b3c5ff]">{scenario.name}</p>
              <p className="font-mono text-[9px] text-[#8c90a1] mt-1">{scenario.updates?.length || 0} updates</p>
            </button>
          ))}
        </div>
      </div>

      <DemoWizard />
    </div>
  )
}
