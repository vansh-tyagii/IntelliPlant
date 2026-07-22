import React from 'react'
import { Modal, Steps, Button, InputNumber, Select, Upload, Spin, Alert, Progress, Tag, Switch } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, CheckCircle, UploadCloud, Play, Cpu, Activity,
  Eye, Zap, AlertTriangle, Shield, BookOpen, ChevronRight,
} from 'lucide-react'
import { useDemoStore } from '@/store/demoStore'
import { useRuntimeStore } from '@/store/runtimeStore'
import { aiModelsService } from '@/services/aiModelsService'
import { incidentService, ragService } from '@/services/ragService'
import { uploadService } from '@/services/liveService'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Ai4iInput } from '@/types/api'
import type { RcFile } from 'antd/es/upload'

const SAMPLES: Ai4iInput[] = [
  { air_temp: 298.1, process_temp: 308.6, rpm: 1551, torque: 42.8, tool_wear: 0, machine_type: 'M' },
  { air_temp: 310.2, process_temp: 325.4, rpm: 2200, torque: 68.9, tool_wear: 180, machine_type: 'H' },
  { air_temp: 295.0, process_temp: 305.0, rpm: 1200, torque: 35.0, tool_wear: 50, machine_type: 'L' },
]

/** Small KV metric card */
const Metric: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent }) => (
  <div className="bg-[#191b24] border border-[#333646] p-2.5">
    <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{label}</p>
    <p className={`font-mono text-sm font-semibold ${accent || 'text-[#b3c5ff]'}`}>{value}</p>
  </div>
)

/** AI decision trace row */
const TraceRow: React.FC<{ icon: React.ReactNode; label: string; value: string; highlight?: boolean }> = ({ icon, label, value, highlight }) => (
  <div className={`flex items-center gap-3 p-2 rounded border ${highlight ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.08)]' : 'border-[#333646] bg-[#191b24]'}`}>
    <span className={`shrink-0 ${highlight ? 'text-[#f59e0b]' : 'text-[#8c90a1]'}`}>{icon}</span>
    <span className="font-mono text-[10px] text-[#8c90a1] w-28 shrink-0">{label}</span>
    <span className={`font-mono text-xs ${highlight ? 'text-[#f59e0b] font-bold' : 'text-[#e1e2ee]'}`}>{value}</span>
  </div>
)

export const DemoWizard: React.FC = () => {
  const {
    wizardOpen, setWizardOpen, wizardStep, nextStep, prevStep, markStepComplete,
    stepsCompleted, selectedZone, ai4iInput, setAi4iInput, setAi4iResult,
    setSwatResult, setPpeResult, setFusionResult, setIncidentResult,
    setRecommendationResult, resetDemo, stepRunning, setStepRunning,
    ai4iResult, swatResult, ppeResult, fusionResult, incidentResult, recommendationResult,
  } = useDemoStore()

  const { updateAi4i, updateSwat, updatePpe, updateFusion } = useRuntimeStore()

  // PPE — video preview state
  const [ppeFile, setPpeFile] = React.useState<File | null>(null)
  const [ppeVideoUrl, setPpeVideoUrl] = React.useState<string | null>(null)
  const [swatReadings, setSwatReadings] = React.useState<Record<string, number>[] | null>(null)
  const [permitType, setPermitType] = React.useState('NONE')
  const [permitActive, setPermitActive] = React.useState(false)
  const [isolationVerified, setIsolationVerified] = React.useState(false)
  const [gasTestPassed, setGasTestPassed] = React.useState(false)
  const [maintenanceActive, setMaintenanceActive] = React.useState(false)
  const [workersInZone, setWorkersInZone] = React.useState(0)
  const [supervisorPresent, setSupervisorPresent] = React.useState(true)
  const [durationHours, setDurationHours] = React.useState(8)
  const [isNightShift, setIsNightShift] = React.useState(false)
  const [minutesToShiftChange, setMinutesToShiftChange] = React.useState<number | null>(null)

  // ── Step 1: AI4I predict ──
  const ai4iMutation = useMutation({
    mutationFn: () => aiModelsService.predictAi4i(ai4iInput!, selectedZone),
    onSuccess: (data) => {
      const result = data?.results?.ai4i
      if (result) { setAi4iResult(result); updateAi4i(selectedZone, result); markStepComplete(0) }
      setStepRunning(false)
    },
    onError: () => setStepRunning(false),
  })

  // ── Step 2: SWAT — fetch 15 CSV rows, display them, then analyze ──
  const swatMutation = useMutation({
    mutationFn: async () => {
      const sampleResp = await aiModelsService.getSWATReadings(15, 0)
      if (!sampleResp.readings || sampleResp.readings.length < 15)
        throw new Error(`SWAT dataset returned only ${sampleResp.readings?.length ?? 0} rows (need 15)`)
      setSwatReadings(sampleResp.readings) // store for display
      return aiModelsService.analyzeSwat({ zone: selectedZone, history: sampleResp.readings })
    },
    onSuccess: (data) => {
      const result = data?.results?.swat
      if (result) { setSwatResult(result); updateSwat(selectedZone, result); markStepComplete(1) }
      setStepRunning(false)
    },
    onError: () => setStepRunning(false),
  })

  // ── Step 3: PPE — upload video, keep it visible, then analyze ──
  const ppeMutation = useMutation({
    mutationFn: async () => {
      if (!ppeFile) throw new Error('Upload an image or video before running PPE analysis.')
      const uploaded = await uploadService.uploadVideo(ppeFile!)
      return aiModelsService.analyzePpe({ zone: selectedZone, video_path: uploaded.video_path })
      /* Legacy branch retained below only to preserve source-map line stability.
         It is unreachable and no longer produces a PPE result. */
      let videoPpeReport: Record<string, unknown> = {}
      if (ppeFile) {
        const uploaded = await uploadService.uploadVideo(ppeFile!)
        videoPpeReport = { video_path: uploaded.video_path, source: 'upload' }
      } else { /* unreachable: PPE always requires an uploaded video
          summary: 'All workers compliant — Hardhat and Safety Vest detected.',
        }
      */ }
      return aiModelsService.analyzePpe({ zone: selectedZone, video_path: String(videoPpeReport.video_path) })
    },
    onSuccess: (data) => {
      const result = data?.results?.ppe
      if (result) { setPpeResult(result); updatePpe(selectedZone, result); markStepComplete(2) }
      setStepRunning(false)
    },
    onError: () => setStepRunning(false),
  })

  // ── Step 4: Fusion ──
  // IMPORTANT: AI4I, SWAT, PPE results are already in backend MEMORY from prior steps.
  // The executor's _assemble_fusion_features() reads them from MEMORY automatically.
  // We only need to run permit + shift (to add operational context) + fusion (to score).
  // Do NOT pass ai4i/ppe as payload here — the executor would try to re-run those
  // agents with the result dict as input, causing Ai4iAgent.run() to fail.
  const fusionMutation = useMutation({
    mutationFn: () => aiModelsService.analyzeFusion({
      zone: selectedZone,
      upstream: { ai4i: ai4iResult ?? undefined, swat: swatResult ?? undefined, ppe: ppeResult ?? undefined },
      // Run permit + shift with user-entered operational context, then fusion.
      agents: ['permit', 'shift', 'fusion'],
      permit: {
        permits: permitActive ? [{
          permit_id: `${selectedZone}-active-permit`, type: permitType, zone: selectedZone,
          isolation_verified: isolationVerified, gas_test_passed: gasTestPassed,
          supervisor_assigned: supervisorPresent, workers_assigned: workersInZone,
        }] : [],
        context: { zone: selectedZone, maintenance_active: maintenanceActive },
      },
      shift: {
        supervisor_present: supervisorPresent, duration_hours: durationHours,
        is_night_shift: isNightShift, workers_on_shift: workersInZone,
        minutes_to_shift_change: minutesToShiftChange,
      },
    }),
    onSuccess: (data) => {
      const result = data?.results?.fusion
      if (result) { setFusionResult(result); updateFusion(selectedZone, result); markStepComplete(3) }
      setStepRunning(false)
    },
    onError: () => setStepRunning(false),
  })

  // ── Step 5 & 6: auto-triggered ──
  const incidentMutation = useMutation({
    mutationFn: () => incidentService.generateIncident(selectedZone),
    onSuccess: (data) => { setIncidentResult(data); markStepComplete(4) },
  })
  const ragMutation = useMutation({
    mutationFn: () => ragService.getRecommendations(selectedZone),
    onSuccess: (data) => { setRecommendationResult(data as unknown as Record<string, unknown>); markStepComplete(5) },
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (stepsCompleted[3] && !stepsCompleted[4]) incidentMutation.mutate() }, [stepsCompleted[3]])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (stepsCompleted[4] && !stepsCompleted[5]) ragMutation.mutate() }, [stepsCompleted[4]])

  const canRunFusion = stepsCompleted[0] && stepsCompleted[1] && stepsCompleted[2]

  const runCurrentStep = () => {
    setStepRunning(true)
    if (wizardStep === 1) ai4iMutation.mutate()
    else if (wizardStep === 2) swatMutation.mutate()
    else if (wizardStep === 3) ppeMutation.mutate()
    else if (wizardStep === 4) fusionMutation.mutate()
  }

  const stepItems = [
    { title: 'Start', description: '', icon: <Play size={12} /> },
    { title: 'Machine', description: 'AI4I', icon: <Cpu size={12} /> },
    { title: 'SCADA', description: 'SWAT', icon: <Activity size={12} /> },
    { title: 'Vision', description: 'PPE', icon: <Eye size={12} /> },
    { title: 'Fusion', description: 'Risk', icon: <Zap size={12} /> },
    { title: 'Incident', description: 'Auto', icon: <AlertTriangle size={12} /> },
    { title: 'RAG', description: 'Action', icon: <BookOpen size={12} /> },
  ]

  const riskColor = (status?: string) => {
    if (!status) return '#8c90a1'
    const s = status.toLowerCase()
    if (s === 'critical') return '#ef4444'
    if (s === 'warning') return '#f59e0b'
    if (s === 'normal' || s === 'safe') return '#22c55e'
    return '#8c90a1'
  }

  const renderStepContent = () => {
    // ── Step 0: Intro ──
    if (wizardStep === 0) return (
      <div className="space-y-5 text-center py-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0066ff] to-[#9c27b0] flex items-center justify-center mx-auto shadow-lg shadow-[#0066ff]/30">
          <Shield size={28} className="text-white" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-xl text-[#e1e2ee] mb-2">ETAI Industrial Safety Demo</h3>
          <p className="font-sans text-sm text-[#c2c6d8] max-w-md mx-auto leading-relaxed">
            Walk through the complete AI decision chain: <strong className="text-[#b3c5ff]">Machine Failure</strong> → <strong className="text-[#22c55e]">SCADA Anomaly</strong> → <strong className="text-[#f59e0b]">PPE Violation</strong> → <strong className="text-[#9c27b0]">Compound Risk Fusion</strong> → <strong className="text-[#ef4444]">Incident</strong> → <strong className="text-[#b3c5ff]">RAG Action</strong>
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 bg-[#272a33] border border-[#424656] px-4 py-2 mx-auto w-fit rounded">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="font-mono text-xs text-[#8c90a1]">Zone: <span className="text-[#b3c5ff]">{selectedZone.toUpperCase()}</span></span>
        </div>
        <p className="font-mono text-[10px] text-[#424656]">Each step shows real AI inference — no mocked data</p>
      </div>
    )

    // ── Step 1: AI4I ──
    if (wizardStep === 1) return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-xs">1</span>
          <div>
            <h3 className="font-display font-semibold text-[#e1e2ee]">Machine Failure Prediction — AI4I</h3>
            <p className="font-mono text-[10px] text-[#8c90a1]">Random Forest · Multi-class failure classifier · Trained on UCI AI4I 2020</p>
          </div>
        </div>

        {/* Sample presets */}
        <div className="grid grid-cols-3 gap-2">
          {SAMPLES.map((s, i) => (
            <button key={i} onClick={() => setAi4iInput(s)}
              className={`p-2 border rounded-sm text-left transition-all ${JSON.stringify(ai4iInput) === JSON.stringify(s) ? 'border-[#0066ff] bg-[rgba(0,102,255,0.12)]' : 'border-[#333646] hover:border-[#8c90a1]'}`}>
              <p className="font-mono text-[9px] text-[#8c90a1] uppercase">
                Preset {i + 1} · {s.machine_type === 'H' ? '⚠ High Risk' : s.machine_type === 'M' ? '~ Medium' : '✓ Low Risk'}
              </p>
              <p className="font-mono text-xs text-[#e1e2ee]">RPM {s.rpm} · Wear {s.tool_wear}min</p>
            </button>
          ))}
        </div>

        {/* Parameter inputs */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: 'Air Temp (K)', key: 'air_temp' as const },
            { label: 'Process Temp (K)', key: 'process_temp' as const },
            { label: 'RPM', key: 'rpm' as const },
            { label: 'Torque (Nm)', key: 'torque' as const },
            { label: 'Tool Wear (min)', key: 'tool_wear' as const },
          ]).map(({ label, key }) => (
            <div key={key}>
              <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">{label}</p>
              <InputNumber
                value={ai4iInput?.[key]}
                onChange={(v) => setAi4iInput({ ...ai4iInput!, [key]: v ?? 0 })}
                style={{ width: '100%' }} size="small"
                step={key === 'rpm' ? 10 : 0.1}
              />
            </div>
          ))}
          <div>
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-1">Machine Type</p>
            <Select value={ai4iInput?.machine_type} onChange={(v) => setAi4iInput({ ...ai4iInput!, machine_type: v })}
              options={[{ value: 'L', label: 'Light (L)' }, { value: 'M', label: 'Medium (M)' }, { value: 'H', label: 'Heavy (H)' }]}
              style={{ width: '100%' }} size="small" />
          </div>
        </div>

        {/* Decision Trace — shown after result */}
        {ai4iResult && stepsCompleted[0] && (
          <div className="border border-[#22c55e]/40 bg-[rgba(34,197,94,0.04)] p-3 space-y-2">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <ChevronRight size={10} className="text-[#22c55e]" /> AI Decision Trace
            </p>
            <div className="space-y-1.5">
              <TraceRow icon={<Cpu size={12} />} label="Input Features" value={`Temp ${ai4iInput?.process_temp}K · RPM ${ai4iInput?.rpm} · Wear ${ai4iInput?.tool_wear}min`} />
              <TraceRow icon={<Activity size={12} />} label="Model Output" value={`Class ${ai4iResult.prediction ?? 0} → ${ai4iResult.failure_type || 'No Failure'}`} highlight={ai4iResult.prediction !== 0} />
              <TraceRow icon={<Shield size={12} />} label="Confidence" value={ai4iResult.confidence != null ? `${(Number(ai4iResult.confidence) * 100).toFixed(1)}%` : 'N/A'} />
              <TraceRow icon={<Zap size={12} />} label="Risk Status" value={(ai4iResult.status || 'normal').toUpperCase()} highlight={ai4iResult.status === 'critical' || ai4iResult.status === 'warning'} />
              {ai4iResult.reason && <TraceRow icon={<BookOpen size={12} />} label="Reason" value={ai4iResult.reason} />}
            </div>
          </div>
        )}
        {ai4iMutation.isError && (
          <Alert type="error" showIcon message={`AI4I: ${(ai4iMutation.error as Error)?.message}`} />
        )}
      </div>
    )

    // ── Step 2: SWAT ──
    if (wizardStep === 2) return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#22c55e] text-white flex items-center justify-center font-bold text-xs">2</span>
          <div>
            <h3 className="font-display font-semibold text-[#e1e2ee]">SCADA Anomaly Detection — SWaT</h3>
            <p className="font-mono text-[10px] text-[#8c90a1]">LSTM Autoencoder · 25 sensors · Reconstruction error threshold · 15-step sequence</p>
          </div>
        </div>

        {/* Live sensor readings preview */}
        {swatReadings ? (
          <div>
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider mb-2">
              Loaded {swatReadings.length} readings from SWaT Dataset
            </p>
            <div className="bg-[#191b24] border border-[#333646] p-3 max-h-[120px] overflow-auto">
              <div className="grid grid-cols-5 gap-x-3 gap-y-0.5">
                {/* Show first 10 columns of last reading */}
                {Object.entries(swatReadings[swatReadings.length - 1]).slice(0, 10).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-[#272a33] py-0.5">
                    <span className="font-mono text-[8px] text-[#8c90a1] truncate w-14">{k}</span>
                    <span className="font-mono text-[8px] text-[#b3c5ff]">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[8px] text-[#424656] mt-1">Showing 10 of {Object.keys(swatReadings[0] || {}).length} sensor columns · Latest reading</p>
            </div>
          </div>
        ) : (
          <div className="bg-[#191b24] border border-[#333646] p-3">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="History Rows" value="15" />
              <Metric label="Sensor Columns" value="25" />
              <Metric label="Dataset" value="SWaT" />
            </div>
            <p className="font-mono text-[10px] text-[#8c90a1] mt-2">
              Click Run to load readings from the dataset and run LSTM autoencoder inference
            </p>
          </div>
        )}

        {/* SWAT result — decision trace */}
        {swatResult && stepsCompleted[1] && (
          <div className="border border-[#22c55e]/40 bg-[rgba(34,197,94,0.04)] p-3 space-y-2">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <ChevronRight size={10} className="text-[#22c55e]" /> LSTM Autoencoder — Anomaly Analysis
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Status" value={(swatResult.status || 'normal').toUpperCase()} accent={riskColor(swatResult.status)} />
              <Metric label="Anomaly Probability" value={swatResult.anomaly_probability != null ? `${(Number(swatResult.anomaly_probability) * 100).toFixed(2)}%` : 'N/A'} accent={Number(swatResult.anomaly_probability) > 0.5 ? '#ef4444' : '#22c55e'} />
              <Metric label="Risk Score" value={swatResult.risk_score != null ? Number(swatResult.risk_score).toFixed(1) : 'N/A'} />
              <Metric label="Reconstruction Error" value={swatResult.raw?.reconstruction_error != null ? Number(swatResult.raw.reconstruction_error).toFixed(6) : 'N/A'} />
            </div>
            {swatResult.raw?.reconstruction_error != null && swatResult.raw?.threshold_95 != null && (
              <div>
                <p className="font-mono text-[9px] text-[#8c90a1] mb-1">Reconstruction Error vs Threshold</p>
                <Progress
                  percent={Math.min(100, (Number(swatResult.raw.reconstruction_error) / Number(swatResult.raw.threshold_95)) * 100)}
                  strokeColor={Number(swatResult.raw.reconstruction_error) > Number(swatResult.raw.threshold_95) ? '#ef4444' : '#22c55e'}
                  format={(p) => <span className="font-mono text-[10px]">{p?.toFixed(0)}% of threshold</span>}
                  size="small"
                />
                <p className="font-mono text-[9px] text-[#8c90a1] mt-0.5">
                  Error: {Number(swatResult.raw.reconstruction_error).toFixed(6)} · Threshold 95%: {Number(swatResult.raw.threshold_95).toFixed(6)}
                </p>
              </div>
            )}
            {swatResult.reason && (
              <p className="font-mono text-[10px] text-[#c2c6d8] italic mt-1">"{swatResult.reason}"</p>
            )}
          </div>
        )}
        {swatMutation.isError && (
          <Alert type="error" showIcon message={`SWAT: ${(swatMutation.error as Error)?.message}`} />
        )}
        {/* Visible loading state while LSTM runs (~5-15s) */}
        {stepRunning && wizardStep === 2 && (
          <div className="flex items-center gap-3 bg-[rgba(34,197,94,0.06)] border border-[#22c55e]/30 px-3 py-2 rounded-sm">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
            <div>
              <p className="font-mono text-[10px] text-[#22c55e]">LSTM Autoencoder — Running Inference</p>
              <p className="font-mono text-[9px] text-[#8c90a1]">Loading SWaT model · Running 15-step sequence · ~5-15s on first call</p>
            </div>
          </div>
        )}
      </div>
    )

    // ── Step 3: PPE ──
    if (wizardStep === 3) return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#f59e0b] text-white flex items-center justify-center font-bold text-xs">3</span>
          <div>
            <h3 className="font-display font-semibold text-[#e1e2ee]">Vision Intelligence — PPE Detection</h3>
            <p className="font-mono text-[10px] text-[#8c90a1]">YOLOv8 · Real-time detection · Hardhat / Vest / Mask / Gloves / Persons</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left: upload + video preview */}
          <div className="space-y-3">
            <Upload.Dragger
              accept="image/*,video/*"
              beforeUpload={(file: RcFile) => {
                setPpeFile(file)
                // Create object URL for in-browser preview
                const url = URL.createObjectURL(file)
                setPpeVideoUrl(url)
                return false
              }}
              maxCount={1}
              showUploadList={false}
              className="!h-[100px]"
            >
              <p className="ant-upload-drag-icon"><UploadCloud size={20} className="text-[#8c90a1] mx-auto" /></p>
              <p className="font-sans text-xs text-[#c2c6d8]">{ppeFile ? ppeFile.name : 'Upload video / image'}</p>
              <p className="font-mono text-[9px] text-[#424656]">MP4, AVI, JPG, PNG · Optional</p>
            </Upload.Dragger>

            {/* Video player — stays visible while detection runs */}
            {ppeVideoUrl && (
              <div className="relative">
                {ppeFile?.type.startsWith('video/') ? (
                  <video
                    src={ppeVideoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    className="w-full rounded border border-[#333646] max-h-[180px] object-contain bg-black"
                  />
                ) : (
                  <img src={ppeVideoUrl} alt="PPE Input" className="w-full rounded border border-[#333646] max-h-[180px] object-contain bg-black" />
                )}
                {ppeMutation.isPending && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded">
                    <div className="text-center">
                      <Spin size="large" />
                      <p className="font-mono text-[10px] text-[#b3c5ff] mt-2">YOLOv8 analyzing…</p>
                    </div>
                  </div>
                )}
                {ppeResult && stepsCompleted[2] && (
                  <div className="absolute top-2 right-2">
                    <span className="font-mono text-[9px] bg-[#22c55e] text-black px-1.5 py-0.5 rounded">DETECTION COMPLETE</span>
                  </div>
                )}
              </div>
            )}

            {!ppeVideoUrl && (
              <div className="bg-[#191b24] border border-dashed border-[#333646] p-4 text-center">
                <Eye size={20} className="text-[#424656] mx-auto mb-1" />
                <p className="font-mono text-[10px] text-[#424656]">No media — demo report will be used</p>
              </div>
            )}
          </div>

          {/* Right: detection results */}
          <div className="space-y-2">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">Detection Results</p>
            {ppeResult && stepsCompleted[2] ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Workers" value={String(ppeResult.workers ?? 0)} accent="#b3c5ff" />
                  <Metric label="Violations" value={String(ppeResult.violations ?? 0)} accent={Number(ppeResult.violations) > 0 ? '#ef4444' : '#22c55e'} />
                  <Metric label="Risk Score" value={ppeResult.risk_score != null ? Number(ppeResult.risk_score).toFixed(1) : 'N/A'} />
                  <Metric label="Status" value={(ppeResult.status || 'normal').toUpperCase()} accent={riskColor(ppeResult.status)} />
                  <Metric label="Frames" value={String(ppeResult.raw?.analyzed_frames ?? 'N/A')} />
                  <Metric label="Max People" value={String(ppeResult.raw?.maximum_people_detected ?? ppeResult.workers ?? 0)} />
                </div>

                {/* PPE class breakdown */}
                {ppeResult.raw?.class_counts && (
                  <div className="bg-[#191b24] border border-[#333646] p-2">
                    <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-1.5">Detected Classes</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(ppeResult.raw.class_counts as Record<string, number>)
                        .filter(([, v]) => v > 0)
                        .map(([cls, count]) => (
                          <Tag key={cls} color={cls.startsWith('NO-') ? 'error' : 'success'} className="font-mono text-[9px]">
                            {cls}: {count}
                          </Tag>
                        ))}
                    </div>
                  </div>
                )}

                {/* Violation breakdown */}
                {ppeResult.raw?.violation_counts && (
                  <div className="bg-[#191b24] border border-[#333646] p-2">
                    <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-1.5">Violations</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(ppeResult.raw.violation_counts as Record<string, number>).map(([viol, count]) => (
                        <Tag key={viol} color={count > 0 ? 'warning' : 'default'} className="font-mono text-[9px]">
                          {viol}: {count}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {ppeResult.reason && (
                  <p className="font-mono text-[10px] text-[#c2c6d8] italic">"{ppeResult.reason}"</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 border border-dashed border-[#333646] text-[#424656]">
                <div className="text-center">
                  <Eye size={20} className="mx-auto mb-1" />
                  <p className="font-mono text-[10px]">Run detection to see results</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {ppeMutation.isError && (
          <Alert type="error" showIcon message={`PPE: ${(ppeMutation.error as Error)?.message}`} />
        )}
      </div>
    )

    // ── Step 4: Fusion ──
    if (wizardStep === 4) return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#9c27b0] text-white flex items-center justify-center font-bold text-xs">4</span>
          <div>
            <h3 className="font-display font-semibold text-[#e1e2ee]">Compound Risk Fusion</h3>
            <p className="font-mono text-[10px] text-[#8c90a1]">Multi-agent fusion · SHAP explainability · Final compound risk score</p>
          </div>
        </div>

        {/* Upstream inputs display */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: 'AI4I', done: stepsCompleted[0], icon: <Cpu size={12} />,
              val: ai4iResult ? `${ai4iResult.failure_type || 'No Failure'} · ${(Number(ai4iResult.confidence ?? 0) * 100).toFixed(0)}%` : '—',
              status: ai4iResult?.status,
            },
            {
              label: 'SWAT', done: stepsCompleted[1], icon: <Activity size={12} />,
              val: swatResult ? `Anomaly: ${swatResult.anomaly_probability != null ? `${(Number(swatResult.anomaly_probability) * 100).toFixed(1)}%` : '—'}` : '—',
              status: swatResult?.status,
            },
            {
              label: 'PPE', done: stepsCompleted[2], icon: <Eye size={12} />,
              val: ppeResult ? `Workers: ${ppeResult.workers ?? 0} · Viol: ${ppeResult.violations ?? 0}` : '—',
              status: ppeResult?.status,
            },
          ].map(({ label, done, icon, val, status }) => (
            <div key={label} className={`p-3 border rounded-sm ${done ? 'border-[#22c55e]/50 bg-[rgba(34,197,94,0.06)]' : 'border-[#333646] opacity-50'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={done ? 'text-[#22c55e]' : 'text-[#424656]'}>{icon}</span>
                <span className="font-mono text-[9px] text-[#8c90a1] uppercase">{label}</span>
                {done && <CheckCircle size={10} className="text-[#22c55e] ml-auto" />}
              </div>
              <p className="font-mono text-[10px] text-[#c2c6d8]">{val}</p>
              {status && <p className="font-mono text-[9px] mt-0.5" style={{ color: riskColor(status) }}>{status.toUpperCase()}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-[#333646] bg-[#191b24] p-3 space-y-2">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase">Permit-to-work context</p>
            <div className="grid grid-cols-2 gap-2 items-center">
              <label className="font-mono text-[10px] text-[#c2c6d8]">Active permit</label><Switch size="small" checked={permitActive} onChange={setPermitActive} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Permit type</label>
              <Select size="small" value={permitType} disabled={!permitActive} onChange={setPermitType} options={['NONE', 'HOT_WORK', 'ELECTRICAL', 'CONFINED_SPACE', 'GAS_TESTING'].map(value => ({ value }))} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Maintenance active</label><Switch size="small" checked={maintenanceActive} onChange={setMaintenanceActive} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Isolation verified</label><Switch size="small" disabled={!permitActive} checked={isolationVerified} onChange={setIsolationVerified} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Gas test passed</label><Switch size="small" disabled={!permitActive} checked={gasTestPassed} onChange={setGasTestPassed} />
            </div>
          </div>
          <div className="border border-[#333646] bg-[#191b24] p-3 space-y-2">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase">Shift & staffing context</p>
            <div className="grid grid-cols-2 gap-2 items-center">
              <label className="font-mono text-[10px] text-[#c2c6d8]">Workers in zone</label><InputNumber size="small" min={0} value={workersInZone} onChange={v => setWorkersInZone(Number(v ?? 0))} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Shift duration (h)</label><InputNumber size="small" min={0} step={0.5} value={durationHours} onChange={v => setDurationHours(Number(v ?? 0))} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Supervisor present</label><Switch size="small" checked={supervisorPresent} onChange={setSupervisorPresent} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Night shift</label><Switch size="small" checked={isNightShift} onChange={setIsNightShift} />
              <label className="font-mono text-[10px] text-[#c2c6d8]">Minutes to handover</label><InputNumber size="small" min={0} value={minutesToShiftChange} placeholder="Not scheduled" onChange={v => setMinutesToShiftChange(v == null ? null : Number(v))} />
            </div>
          </div>
        </div>

        {!canRunFusion && (
          <Alert type="warning" showIcon message={
            <span className="font-mono text-xs">
              Complete steps 1–3 first. Missing: {[!stepsCompleted[0] && 'AI4I', !stepsCompleted[1] && 'SWAT', !stepsCompleted[2] && 'PPE'].filter(Boolean).join(', ')}
            </span>
          } />
        )}

        {/* Fusion result */}
        {fusionResult && stepsCompleted[3] && (
          <div className="border border-[#9c27b0]/50 bg-[rgba(156,39,176,0.06)] p-4 space-y-3">
            <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-widest flex items-center gap-1.5">
              <ChevronRight size={10} className="text-[#9c27b0]" /> Fusion Output — Compound Risk Assessment
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Risk Level" value={String(fusionResult.raw?.risk_level || fusionResult.status || 'safe').toUpperCase()} accent={riskColor(fusionResult.raw?.risk_level || fusionResult.status)} />
              <Metric label="Critical Probability" value={fusionResult.critical_probability != null ? `${(Number(fusionResult.critical_probability) * 100).toFixed(2)}%` : 'N/A'} accent={Number(fusionResult.critical_probability) > 0.5 ? '#ef4444' : '#22c55e'} />
              <Metric label="Compound Risk Score" value={fusionResult.compound_risk != null ? Number(fusionResult.compound_risk).toFixed(1) : 'N/A'} />
              <Metric label="Decision" value={fusionResult.is_critical ? '⚠ CRITICAL' : '✓ SAFE'} accent={fusionResult.is_critical ? '#ef4444' : '#22c55e'} />
            </div>
            {/* SHAP top contributors */}
            {fusionResult.top_contributors && fusionResult.top_contributors.length > 0 && (
              <div>
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-2">Top Risk Contributors (SHAP)</p>
                <div className="space-y-1">
                  {fusionResult.top_contributors.slice(0, 4).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#8c90a1] w-36 truncate">{c.feature}</span>
                      <div className="flex-1 h-1.5 bg-[#272a33] rounded">
                        <div className="h-full rounded bg-gradient-to-r from-[#0066ff] to-[#9c27b0]"
                          style={{ width: `${Math.min(100, Math.abs(Number(c.normalized_percentage) || Number(c.shap_contribution) * 100))}%` }} />
                      </div>
                      <span className="font-mono text-[9px] text-[#b3c5ff] w-12 text-right">{c.shap_contribution.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {fusionMutation.isError && (
          <Alert type="error" showIcon message={`Fusion: ${(fusionMutation.error as Error)?.message}`} />
        )}
      </div>
    )

    // ── Step 5: Incident ──
    if (wizardStep === 5) return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#ef4444] text-white flex items-center justify-center font-bold text-xs">5</span>
          <div>
            <h3 className="font-display font-semibold text-[#e1e2ee]">Incident Report — Auto Generated</h3>
            <p className="font-mono text-[10px] text-[#8c90a1]">Triggered by compound risk · Cross-referenced against permit + shift data</p>
          </div>
        </div>
        {incidentMutation.isPending ? (
          <div className="flex flex-col items-center gap-2 p-8">
            <Spin size="large" />
            <p className="font-mono text-xs text-[#8c90a1]">Generating incident report from fusion output…</p>
          </div>
        ) : incidentResult ? (
          <div className="space-y-3">
            <div className="border-l-4 border-[#ef4444] bg-[rgba(239,68,68,0.06)] p-4 space-y-3">
              <div className="flex items-center gap-3">
                <StatusBadge level={(incidentResult.risk_level?.toLowerCase() as 'normal') || 'warning'} size="md" pulse />
                <div>
                  <p className="font-mono text-[9px] text-[#8c90a1]">INCIDENT ID</p>
                  <p className="font-mono text-xs text-[#b3c5ff]">{incidentResult.incident_id || 'INC-' + Date.now()}</p>
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] text-[#8c90a1] uppercase mb-1">Root Cause Analysis</p>
                <p className="font-sans text-sm text-[#e1e2ee] leading-relaxed">
                  {incidentResult.root_cause || incidentResult.summary || 'Compound risk threshold exceeded.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Zone" value={incidentResult.zone || incidentResult.zone_id || selectedZone} />
                <Metric label="Workers at Risk" value={String(incidentResult.workers ?? 'N/A')} accent={Number(incidentResult.workers) > 0 ? '#f59e0b' : '#22c55e'} />
                <Metric label="Risk Score" value={incidentResult.compound_risk_score != null ? Number(incidentResult.compound_risk_score).toFixed(1) : 'N/A'} accent="#ef4444" />
              </div>
              {incidentResult.machine_status && incidentResult.machine_status !== 'No Failure' && (
                <p className="font-mono text-[10px] text-[#f59e0b]">⚠ Machine: {incidentResult.machine_status}</p>
              )}
              {Array.isArray(incidentResult.top_contributors) && incidentResult.top_contributors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {incidentResult.top_contributors.slice(0, 4).map((c: unknown, i: number) => (
                    <Tag key={i} color="orange" className="font-mono text-[9px]">
                      {typeof c === 'string' ? c : (c as { feature?: string })?.feature || String(c)}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="font-sans text-sm text-[#8c90a1]">Generating incident report…</p>
        )}
      </div>
    )

    // ── Step 6: RAG Recommendation ──
    if (wizardStep === 6) return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#22c55e] text-white flex items-center justify-center font-bold text-xs">6</span>
          <div>
            <h3 className="font-display font-semibold text-[#e1e2ee]">RAG-Powered Safety Recommendation</h3>
            <p className="font-mono text-[10px] text-[#8c90a1]">FAISS + LLM · OISD · Factories Act · DGMS · IS Standards</p>
          </div>
        </div>
        {ragMutation.isPending ? (
          <div className="flex flex-col items-center gap-2 p-8">
            <Spin size="large" />
            <p className="font-mono text-xs text-[#8c90a1]">Querying regulatory knowledge base…</p>
          </div>
        ) : recommendationResult ? (
          <div className="space-y-3">
            {/* Immediate action */}
            <div className="bg-[#272a33] border-l-4 border-[#f59e0b] p-4">
              <p className="font-mono text-[9px] text-[#f59e0b] uppercase tracking-wider mb-1">⚡ Immediate Action Required</p>
              <p className="font-sans text-sm text-[#e1e2ee] leading-relaxed">
                {String(recommendationResult.immediate_action || 'Continue monitoring.')}
              </p>
            </div>
            {/* Emergency action */}
            {Boolean(recommendationResult.emergency_action) && (
              <div className="bg-[rgba(239,68,68,0.06)] border border-[#ef4444]/30 p-3">
                <p className="font-mono text-[9px] text-[#ef4444] uppercase tracking-wider mb-1">Emergency Protocol</p>
                <p className="font-sans text-xs text-[#c2c6d8]">{String(recommendationResult.emergency_action)}</p>
              </div>
            )}
            {/* Regulatory refs */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { label: 'OISD', key: 'oisd' },
                { label: 'Factory Act', key: 'factory_act' },
                { label: 'DGMS', key: 'dgms' },
              ] as { label: string; key: string }[]).filter(({ key }) => Boolean(recommendationResult[key])).map(({ label, key }) => (
                <div key={key} className="bg-[#191b24] border border-[#333646] p-2">
                  <p className="font-mono text-[8px] text-[#8c90a1] uppercase mb-1">{label}</p>
                  <p className="font-mono text-[9px] text-[#b3c5ff] line-clamp-3">{String(recommendationResult[key]).slice(0, 120)}</p>
                </div>
              ))}
            </div>
            {/* Completion banner */}
            <div className="bg-gradient-to-r from-[rgba(34,197,94,0.1)] to-[rgba(0,102,255,0.1)] border border-[#22c55e]/50 p-4 text-center">
              <CheckCircle size={24} className="text-[#22c55e] mx-auto mb-2" />
              <p className="font-display font-bold text-[#22c55e] text-lg">Demo Complete!</p>
              <p className="font-sans text-xs text-[#8c90a1] mt-1">
                6 AI modules · Real backend inference · Zero mocked data
              </p>
              <div className="flex justify-center gap-3 mt-3">
                {['AI4I', 'SWAT', 'PPE', 'Fusion', 'Incident', 'RAG'].map((m) => (
                  <span key={m} className="font-mono text-[9px] bg-[#272a33] border border-[#22c55e]/30 text-[#22c55e] px-2 py-0.5 rounded">{m} ✓</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="font-sans text-sm text-[#8c90a1]">Fetching recommendation…</p>
        )}
      </div>
    )

    return null
  }

  const isRunStep = wizardStep >= 1 && wizardStep <= 4 && !stepsCompleted[wizardStep - 1]
  const isFusionStep = wizardStep === 4

  return (
    <Modal
      open={wizardOpen}
      onCancel={() => setWizardOpen(false)}
      footer={null}
      width={820}
      styles={{ body: { maxHeight: '80vh', overflowY: 'auto', overflowX: 'hidden', minWidth: 0 } }}
      title={
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#b3c5ff]" />
          <span className="font-display font-semibold text-[#e1e2ee]">ETAI Hackathon — Demo Wizard</span>
          <span className="ml-auto font-mono text-[10px] text-[#8c90a1] bg-[#272a33] px-2 py-0.5 rounded">
            {selectedZone.toUpperCase()}
          </span>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        <Steps
          current={wizardStep}
          items={stepItems}
          size="small"
          labelPlacement="vertical"
          className="!px-2"
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={wizardStep}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="min-h-[220px]"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between border-t border-[#333646] pt-4">
          <div className="flex gap-2">
            <Button onClick={resetDemo} danger size="small">Reset</Button>
            {wizardStep > 0 && <Button onClick={prevStep} size="small">← Back</Button>}
          </div>
          <div className="flex gap-2 items-center">
            {/* Progress */}
            <span className="font-mono text-[10px] text-[#8c90a1]">
              {stepsCompleted.filter(Boolean).length}/6 completed
            </span>
            {isRunStep && (
              <Button
                type="primary"
                loading={stepRunning}
                disabled={isFusionStep && !canRunFusion}
                icon={isFusionStep && !canRunFusion ? <Lock size={12} /> : undefined}
                onClick={runCurrentStep}
                size="middle"
              >
                {isFusionStep ? '🔀 Run Fusion' : '▶ Run'}
              </Button>
            )}
            {(stepsCompleted[wizardStep - 1] || wizardStep === 0 || wizardStep >= 5) && wizardStep < 6 && (
              <Button type="primary" onClick={nextStep} size="middle">Next →</Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
