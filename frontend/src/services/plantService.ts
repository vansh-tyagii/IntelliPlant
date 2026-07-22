import apiClient from './api'
import type { PlantLayout, ZoneView, ZoneDetail, TimelineEvent } from '@/types/api'

export const plantService = {
  getPlantLayout: () => apiClient.get<PlantLayout>('/api/plant/layout').then(r => r.data),
  getZones: () => apiClient.get<{ zones: ZoneView[] }>('/api/zones').then(r => r.data),
  getZone: (id: string) => apiClient.get<ZoneDetail>(`/api/zones/${id}`).then(r => r.data),
  getZoneTimeline: (id: string) => apiClient.get<{ zone_id: string; timeline: TimelineEvent[] }>(`/api/zones/${id}/timeline`).then(r => r.data),
  getTimeline: () => apiClient.get<{ events: TimelineEvent[] }>('/api/timeline').then(r => r.data),
  getRecommendations: (zoneId: string) => apiClient.get(`/api/recommendations/${zoneId}`).then(r => r.data),
  getFusionExplain: (zoneId: string) => apiClient.get(`/api/fusion/explain/${zoneId}`).then(r => r.data),
}
