import apiClient from './api'
import type { ComplianceResponse, RecommendationResponse, FusionExplain, Incident, IncidentReport } from '@/types/api'

export const ragService = {
  // RAG calls an LLM pipeline — can take 30-60s on first call
  askCompliance: (question: string, zone = 'default') =>
    apiClient.post<ComplianceResponse>('/api/rag/compliance', { question, zone }, { timeout: 60000 }).then(r => r.data),

  getRecommendations: (zoneId: string) =>
    apiClient.get<RecommendationResponse>(`/api/recommendations/${zoneId}`).then(r => r.data),

  getFusionExplain: (zoneId: string) =>
    apiClient.get<FusionExplain>(`/api/fusion/explain/${zoneId}`).then(r => r.data),
}

export const incidentService = {
  generateIncident: (zone: string) =>
    apiClient.post<Incident>(`/api/incidents/${zone}`).then(r => r.data),

  getIncidents: (limit = 20) =>
    apiClient.get<{ incidents: Incident[] }>('/api/incidents', { params: { limit } }).then(r => r.data),

  getIncidentReport: (incidentId: string) =>
    apiClient.get<IncidentReport>(`/api/incidents/${incidentId}/report`).then(r => r.data),
}

export const agentService = {
  // Agent chat runs the full multi-agent pipeline — can take 30-60s
  chatWithCopilot: (query: string, context: Record<string, unknown> = {}) =>
    apiClient.post('/api/agents/chat', { query, ...context }, { timeout: 60000 }).then(r => r.data),

  analyzeAgents: (payload: {
    zone?: string
    agents?: string[]
    query?: string
    [key: string]: unknown
  }) => apiClient.post('/api/agents/analyze', payload).then(r => r.data),
}
