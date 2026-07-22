import apiClient from './api'
import type { LiveStatus } from '@/types/api'

export const liveService = {
  startLive: (payload: {
    zone?: string
    interval_seconds?: number
    swat_csv?: string
    ai4i_csv?: string
    video_path?: string
    permit?: Record<string, unknown>
    shift?: Record<string, unknown>
    start_offset?: number
  }) => apiClient.post('/api/live/start', payload).then(r => r.data),

  startAllLive: (payload: {
    interval_seconds?: number
    swat_csv?: string
    ai4i_csv?: string
    video_path?: string
    permit?: Record<string, unknown>
    shift?: Record<string, unknown>
    offset_step?: number
  }) => apiClient.post('/api/live/start-all', payload, { timeout: 90000 }).then(r => r.data),

  // tick takes up to ~5s: SWAT LSTM runs ~3-4s per zone on CPU
  tickLive: (zone: string) => apiClient.post(`/api/live/tick/${zone}`, undefined, { timeout: 45000 }).then(r => r.data),

  getLiveStatus: (zone: string) => apiClient.get<LiveStatus>(`/api/live/status/${zone}`).then(r => r.data),

  stopLive: (zone: string) => apiClient.post(`/api/live/stop/${zone}`).then(r => r.data),

  updateContext: (zone: string, payload: { permit?: Record<string, unknown>; shift?: Record<string, unknown> }) =>
    apiClient.put(`/api/live/context/${zone}`, payload).then(r => r.data),
}

export const uploadService = {
  uploadVideo: async (file: File): Promise<{ filename: string; video_path: string; size_bytes: number }> => {
    const arrayBuffer = await file.arrayBuffer()
    const response = await apiClient.post(`/api/uploads/video/${encodeURIComponent(file.name)}`, arrayBuffer, {
      headers: { 'Content-Type': file.type || 'video/mp4', 'Content-Length': String(file.size) },
    })
    return response.data
  },
}
