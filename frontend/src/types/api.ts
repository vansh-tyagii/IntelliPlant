// ── All API types — field names match EXACT backend response schemas ──
// Last verified: live API probe 2026-07-21

export type RiskLevel = 'normal' | 'warning' | 'critical' | 'unknown' | 'safe'

// ── Plant / Zones ──
export interface ZoneMetadata {
  floor?: string
  area_type?: string
}

export interface TimelineEvent {
  timestamp: string
  source: string
  risk_level: RiskLevel
  message?: string
  description?: string
  zone_id?: string
  zone_name?: string
  recommendation?: string
  payload?: Record<string, unknown>
  [key: string]: unknown
}

export interface ZoneCoordinates {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface Zone {
  zone_id: string
  zone_name: string
  risk_level: RiskLevel
  fusion_status?: string
  machine_status?: string
  swat_status?: string
  ppe_status?: string
  last_update?: string
  metadata: ZoneMetadata
  timeline: TimelineEvent[]
  recommendation?: string
}

export interface ZoneView extends Zone {
  display_name: string
  coordinates: ZoneCoordinates
  icon?: string
  risk_label: string
  risk_color: string
  alerts?: TimelineEvent[]
}

export interface ZoneDetail extends ZoneView {
  latest_ai4i_output?: Ai4iResult | null
  latest_swat_output?: SwatResult | null
  latest_ppe_output?: PpeResult | null
  fusion_output?: FusionResult | null
}

// ── Heatmap ──
export interface HeatmapCell {
  zone_id: string
  zone_name: string
  risk_level: RiskLevel
  risk_score: number
  fusion_status?: string
  last_update?: string
  metadata?: ZoneMetadata
}

export interface HeatmapData {
  legend: Record<string, number>
  cells: HeatmapCell[]
}

// ── Plant Layout ──
export interface PlantCanvas {
  width: number
  height: number
}

export interface PlantLayout {
  background_image: string
  canvas: PlantCanvas
  zones: ZoneView[]
}

// ── Dashboard ──
export interface DashboardData {
  system_health: string
  plant_statistics: PlantSummary
  critical_zones: ZoneView[]
  warning_zones: ZoneView[]
  safe_zones: ZoneView[]
  active_incidents: Incident[]
  average_risk: number
  timestamp: string
  model_status?: Record<string, unknown>
}

export interface PlantSummary {
  total_zones: number
  critical_count: number
  warning_count: number
  normal_count: number
  last_update?: string
}

// ── AI4I ──
export interface Ai4iInput {
  air_temp: number
  process_temp: number
  rpm: number
  torque: number
  tool_wear: number
  machine_type: string
}

// Actual backend response field names (from live probe)
export interface Ai4iResult {
  agent?: string
  status?: string          // "normal" | "warning" | "critical" — this is the risk level indicator
  risk_score?: number      // 0–100
  prediction?: number      // 0 = no failure, non-zero = failure code
  failure_type?: string    // "No Failure" | "Overstrain Failure" | etc.
  confidence?: number      // 0.0–1.0
  reason?: string
  raw?: {
    prediction?: number
    failure_type?: string
    confidence?: number
  }
  [key: string]: unknown
}

// ── SWAT ──
export interface SwatResult {
  agent?: string
  status?: string          // "normal" | "warning" | "critical"
  risk_score?: number      // 0–100
  anomaly_probability?: number  // 0.0–1.0 — CORRECT field name (not anomaly_score!)
  reason?: string
  raw?: {
    module_name?: string
    anomaly_probability?: number
    reconstruction_error?: number
    threshold_95?: number
    threshold_99?: number
    status?: string
    history_rows_used?: number
  }
  [key: string]: unknown
}

// ── PPE ──
export interface PpeDetection {
  class_id?: number
  class?: string
  confidence?: number
  bbox_xyxy?: number[]
  worker_id?: number | null
}

export interface PpeFusionFeatures {
  ppe_risk_score?: number
  helmet_missing?: number
  vest_missing?: number
  mask_missing?: number
  worker_count?: number
  vehicle_count?: number
  machinery_count?: number
  compliance_score?: number
}

export interface PpeResult {
  agent?: string
  status?: string          // "normal" | "warning" | "critical"
  risk_score?: number
  workers?: number         // CORRECT field name (not workers_detected!)
  violations?: number      // CORRECT field name (not violation_count!)
  reason?: string
  fusion_features?: PpeFusionFeatures
  raw?: {
    workers_detected?: number
    violations?: number
    ppe_detected?: string[]
    summary?: string
    class_counts?: Record<string, number>
    violation_counts?: Record<string, number>
    detections?: PpeDetection[]
    fps?: number
    total_frames?: number
    analyzed_frames?: number
    maximum_people_detected?: number
    average_people_detected?: number
    detected_ppe_items?: string[]
    sampling_interval?: number
    unique_workers?: number
    average_ppe_compliance?: number
    detected_media_url?: string
  }
  [key: string]: unknown
}

// ── Fusion ──
export interface ShapContributor {
  feature: string
  shap_contribution: number
  direction?: string       // "increases_risk" | "decreases_risk"
  normalized_percentage?: number
  value?: string | number
}

export interface FusionResult {
  agent?: string
  status?: string          // "safe" | "normal" | "warning" | "critical"
  compound_risk?: number   // 0–100
  critical_probability?: number  // 0.0–1.0 (what frontend was calling "confidence")
  is_critical?: boolean
  top_contributors?: ShapContributor[]
  raw?: {
    module_name?: string
    critical_probability?: number
    is_critical?: number   // 0 or 1
    risk_level?: string    // "SAFE" | "NORMAL" | "WARNING" | "CRITICAL"
    decision_threshold?: number
    features_used?: Record<string, unknown>
  }
  // Plant Twin fields (from GET /api/zones/{id} fusion_output)
  risk_level?: RiskLevel
  fusion_status?: string
  explanation?: string
  recommendation?: string
  [key: string]: unknown
}

export interface FusionExplain {
  zone_id: string
  fusion_status?: string
  feature_contributions: ShapContributor[]
  groups: Record<string, ShapContributor[]>
}

// ── Incidents ── (REAL schema from /api/incidents probe)
export interface Incident {
  incident_id?: string
  id?: string
  // zone identification — backend uses "zone" not "affected_zone"
  zone?: string
  zone_id?: string
  affected_zone?: string   // used in incident_report endpoint
  // timestamps — backend uses timestamp_utc in /api/incidents
  timestamp_utc?: string
  timestamp?: string
  risk_level?: string
  confidence?: number
  compound_risk_score?: number
  gas_status?: string
  machine_status?: string
  workers?: number
  root_cause?: string      // backend field name (not "summary"!)
  summary?: string         // may exist in twin incidents
  top_contributors?: ShapContributor[]
  violated_regulations?: string[]
  emergency_actions?: string[]
  compliance_answer?: string | null
  permit?: Record<string, unknown>
  contributing_modules?: string[]
  recommendation?: string
  [key: string]: unknown
}

export interface IncidentReport {
  incident: Incident
  affected_zone?: ZoneView | null
  contributing_modules: string[]
  timeline: TimelineEvent[]
  recommendation: string
  risk_summary: string
}

// ── System Health ──
export interface SystemHealth {
  status: string
  uptime_seconds: number
  timestamp: string
  modules?: RuntimeModules
}

export interface RuntimeModules {
  known_modules: string[]
  loaded_by_zone: Record<string, string[]>
}

export interface ApiStatus {
  status: string
  project_root?: string
  agents?: string[]
  zones?: string[]
  rag_ready?: boolean
  rag_error?: string
}

// ── Runtime State ── (from /api/runtime/state)
export interface RuntimeState {
  zones: Record<string, RuntimeZoneSnapshot>
  last_update?: string | null
  uptime_seconds?: number
}

export interface RuntimeZoneSnapshot {
  ai4i?: Ai4iResult
  swat?: SwatResult
  ppe?: PpeResult
  fusion?: FusionResult
  permit?: Record<string, unknown>
  shift?: Record<string, unknown>
  _updated_at?: string
  [key: string]: unknown
}

// ── Scenarios ──
export interface ScenarioUpdate {
  zone_id: string
  source: string
  payload: Record<string, unknown>
}

export interface Scenario {
  scenario_id: string
  name: string
  updates?: ScenarioUpdate[]
  [key: string]: unknown
}

export interface PlaybackState {
  mode: string
  running: boolean
  position: number
  scenario_id?: string | null
  available: string[]
}

export interface ScenariosResponse {
  scenarios: Scenario[]
  playback: PlaybackState
}

// ── Live ──
export interface LiveStatus {
  zone?: string
  running?: boolean
  position?: number
  interval_seconds?: number
  last_tick?: string
  ticks?: number
  swat_row?: number
  ai4i_row?: number
  sources?: Record<string, string>
  last_result?: Record<string, unknown> | null
  last_error?: string | null
  [key: string]: unknown
}

// ── Live Tick Result ── (actual shape from /api/live/tick/{zone})
export interface LiveTickResult {
  zone: string
  plan: { agents: string[]; reasoning: string }
  results: {
    swat?: SwatResult
    ai4i?: Ai4iResult
    ppe?: PpeResult
    permit?: Record<string, unknown>
    shift?: Record<string, unknown>
    fusion?: FusionResult
  }
}

// ── Compliance / RAG ──
// IMPORTANT: top-level "answer" may be null due to FAISS index issue.
// Fall back to raw.answer when answer is null.
export interface ComplianceResponse {
  agent?: string
  status?: string
  answer?: string | null
  sources?: string[]
  context_used?: string
  raw?: {
    answer?: string | null
    sources?: string[]
    context_used?: string
    error?: string
  }
  zone?: string
  question?: string
  [key: string]: unknown
}

// ── Recommendation ──
export interface RecommendationResponse {
  zone_id: string
  immediate_action: string
  oisd?: string
  factory_act?: string
  dgms?: string
  emergency_action: string
  reason: string
}

// ── Alerts ──
export interface AlertEntry {
  zone_id: string
  zone_name: string
  timestamp: string
  risk_level: RiskLevel
  source?: string
  message?: string
  description?: string
  payload?: Record<string, unknown>  // contains full fusion result
  [key: string]: unknown
}

export interface AlertsResponse {
  alerts: AlertEntry[]
}

// ── Chat / Agent ── (from /api/agents/chat probe)
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AgentChatResponse {
  query?: string
  plan?: Record<string, unknown>
  answer?: string    // CORRECT field (not "response")
  agent_results?: Record<string, unknown>
  [key: string]: unknown
}

// ── Catalog ──
export interface ApiCatalog {
  service: string
  docs: string
  groups: Record<string, string[]>
  available_scenarios: string[]
  available_videos: string[]
  available_datasets: string[]
  plant_metadata: Record<string, unknown>
}

// ── SWAT Sample Readings ── (new integration adapter endpoint)
export interface SwatReadingsResponse {
  readings: Record<string, number>[]
  count: number
  offset: number
  columns: string[]
}

export interface Ai4iReadingsResponse {
  readings: Ai4iInput[]
  count: number
  offset: number
}
