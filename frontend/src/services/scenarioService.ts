import apiClient from './api'
import type { ScenariosResponse, PlaybackState } from '@/types/api'

export const scenarioService = {
  getScenarios: () => apiClient.get<ScenariosResponse>('/api/scenarios').then(r => r.data),

  loadScenario: (scenarioId: string, requestRecommendation = false) =>
    apiClient.post('/api/scenarios/load', { scenario_id: scenarioId, request_recommendation: requestRecommendation }).then(r => r.data),

  resetScenario: () => apiClient.post('/api/scenarios/reset').then(r => r.data),

  controlScenario: (action: 'play' | 'pause' | 'next' | 'previous') =>
    apiClient.post<PlaybackState>(`/api/scenarios/${action}`).then(r => r.data),
}

export const demoService = {
  runDemo: (payload: Record<string, unknown>) => apiClient.post('/api/demo/run', payload).then(r => r.data),
  getDemoStatus: () => apiClient.get('/api/demo/status').then(r => r.data),
  controlDemo: (action: 'play' | 'pause' | 'reset' | 'next' | 'previous') =>
    apiClient.post(`/api/demo/${action}`).then(r => r.data),
}
