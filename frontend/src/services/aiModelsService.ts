import apiClient from './api'
import type {
  Ai4iInput, Ai4iResult, SwatResult, PpeResult, FusionResult,
  SwatReadingsResponse, Ai4iReadingsResponse,
} from '@/types/api'

// ── Shared envelope type for all /api/models/* and /api/fusion/* responses ──
export interface ModelEnvelope<T> {
  zone?: string
  plan?: { agents: string[]; reasoning: string }
  results: T
}

export const aiModelsService = {
  // POST /api/models/ai4i/predict
  // Response: { zone, plan, results: { ai4i: Ai4iResult } }
  predictAi4i: (input: Ai4iInput, zone = 'machine-hall') =>
    apiClient
      .post<ModelEnvelope<{ ai4i: Ai4iResult }>>('/api/models/ai4i/predict', input, { params: { zone } })
      .then(r => r.data),

  // POST /api/models/swat/analyze
  // IMPORTANT: Backend requires EXACTLY ONE of: reading (single) OR history (list of 15).
  // Providing neither raises HTTP 422.
  // Use getSWATReadings() first in demo mode to get the history array.
  // NOTE: SWAT runs an LSTM autoencoder — first call per zone loads TF model (~5-10s).
  analyzeSwat: (payload: {
    zone?: string
    reading?: Record<string, number>
    history?: Record<string, number>[]
  }) =>
    apiClient
      .post<ModelEnvelope<{ swat: SwatResult }>>('/api/models/swat/analyze', payload, { timeout: 45000 })
      .then(r => r.data),


  // POST /api/models/ppe/analyze
  // Accepts: { zone, report: { any PPE report dict } }
  // The backend extracts features from the report dict, model uses its own weights.
  analyzePpe: (payload: { zone?: string; report?: Record<string, unknown>; video_path?: string }) =>
    apiClient
      .post<ModelEnvelope<{ ppe: PpeResult }>>('/api/models/ppe/analyze', payload)
      .then(r => r.data),

  // POST /api/fusion/analyze
  // Pass ai4i, swat, ppe from completed steps so Fusion uses real upstream data.
  analyzeFusion: (payload: {
    zone?: string
    agents?: string[]
    swat?: Record<string, unknown>
    ai4i?: Record<string, unknown>
    ppe?: Record<string, unknown>
    permit?: Record<string, unknown>
    shift?: Record<string, unknown>
    operational_context?: {
      permit_conflict_score: number
      shift_context_score: number
      permit_type: string
      permit_active: number
      maintenance_active: number
      isolation_verified: number
      workers_in_zone: number
      supervisor_present: number
      shift_change_flag: number
    }
    upstream?: { ai4i?: Record<string, unknown>; swat?: Record<string, unknown>; ppe?: Record<string, unknown> }
  }) =>
    apiClient
      .post<ModelEnvelope<{ fusion: FusionResult; permit?: unknown; shift?: unknown }>>(
        '/api/fusion/analyze',
        payload,
      )
      .then(r => r.data),

  runAgentsAnalyze: (payload: {
    zone?: string
    agents?: string[]
    query?: string
    [key: string]: unknown
  }) => apiClient.post('/api/agents/analyze', payload).then(r => r.data),

  // ── Integration adapter endpoints (new, read-only CSV samplers) ──

  // GET /api/models/swat/readings?n=15 — returns N rows from the SWAT CSV.
  // Use this BEFORE calling analyzeSwat in demo mode to get a valid history payload.
  getSWATReadings: (n = 15, offset = 0) =>
    apiClient
      .get<SwatReadingsResponse>('/api/models/swat/readings', { params: { n, offset } })
      .then(r => r.data),

  // GET /api/models/ai4i/readings?n=5 — returns sample AI4I rows for demo pre-fill.
  getAI4IReadings: (n = 5, offset = 0) =>
    apiClient
      .get<Ai4iReadingsResponse>('/api/models/ai4i/readings', { params: { n, offset } })
      .then(r => r.data),
}
