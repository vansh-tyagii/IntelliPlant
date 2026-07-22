import axios from 'axios'
import { notification } from 'antd'

// Empty means same-origin. Vite proxies /api and /ws in development, while
// deployments can supply VITE_API_URL without rebuilding application code.
let baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const apiClient = axios.create({
  baseURL: baseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Response interceptor — show error toasts for non-2xx
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      'An unexpected error occurred'
    if (error?.response?.status !== 404) {
      notification.error({
        message: `API Error ${error?.response?.status || ''}`.trim(),
        description: String(message).slice(0, 200),
        duration: 5,
        placement: 'topRight',
      })
    }
    return Promise.reject(error)
  }
)

export function setApiBaseUrl(url: string): void {
  baseUrl = url.trim().replace(/\/$/, '')
  apiClient.defaults.baseURL = baseUrl
}

export function getWsBaseUrl(): string {
  if (baseUrl) return baseUrl.replace(/^http/, 'ws')
  return window.location.origin.replace(/^http/, 'ws')
}

export default apiClient
