import apiClient from './api'
import type { ApiStatus, SystemHealth, RuntimeModules, ApiCatalog } from '@/types/api'

export const healthService = {
  getRoot: () => apiClient.get<{ service: string; status: string; docs: string }>('/').then(r => r.data),
  getStatus: () => apiClient.get<ApiStatus>('/api/status').then(r => r.data),
  getSystemHealth: () => apiClient.get<SystemHealth>('/api/system/health').then(r => r.data),
  getSystemVersion: () => apiClient.get<{ api_version: string; service: string }>('/api/system/version').then(r => r.data),
  getSystemConfig: () => apiClient.get<Record<string, unknown>>('/api/system/config').then(r => r.data),
  getSystemModules: () => apiClient.get<RuntimeModules>('/api/system/modules').then(r => r.data),
  getCatalog: () => apiClient.get<ApiCatalog>('/api/catalog').then(r => r.data),
  getRuntimeModules: () => apiClient.get<RuntimeModules>('/api/runtime/modules').then(r => r.data),
}
