import apiClient from './api'
import type { DashboardData, HeatmapData, PlantSummary, AlertsResponse, RuntimeState } from '@/types/api'

export const dashboardService = {
  getDashboard: () => apiClient.get<DashboardData>('/api/dashboard').then(r => r.data),
  getOverview: () => apiClient.get<{ plant: PlantSummary; zones: unknown[]; incidents: unknown[] }>('/api/visualizations/overview').then(r => r.data),
  getHeatmap: () => apiClient.get<HeatmapData>('/api/visualizations/heatmap').then(r => r.data),
  getAlerts: () => apiClient.get<AlertsResponse>('/api/alerts').then(r => r.data),
  getRuntimeState: () => apiClient.get<RuntimeState>('/api/runtime/state').then(r => r.data),
  getTimeline: () => apiClient.get<{ events: unknown[] }>('/api/timeline').then(r => r.data),
}
