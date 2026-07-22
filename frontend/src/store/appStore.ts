import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppMode = 'demo' | 'live'
export type Theme = 'dark' | 'light'

interface Notification {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  timestamp: string
  zone_id?: string
  acknowledged: boolean
}

interface AppState {
  mode: AppMode
  theme: Theme
  sidebarCollapsed: boolean
  currentZone: string | null
  isBackendHealthy: boolean
  backendStatus: string
  modelsLoaded: boolean
  notifications: Notification[]
  unreadCount: number
  pollingInterval: number
  apiUrl: string

  // Actions
  setMode: (mode: AppMode) => void
  setTheme: (theme: Theme) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCurrentZone: (zone: string | null) => void
  setBackendHealth: (healthy: boolean, status?: string, modelsLoaded?: boolean) => void
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'acknowledged'>) => void
  acknowledgeNotification: (id: string) => void
  clearAllNotifications: () => void
  setPollingInterval: (ms: number) => void
  setApiUrl: (url: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'demo',
      theme: 'dark',
      sidebarCollapsed: false,
      currentZone: null,
      isBackendHealthy: false,
      backendStatus: 'checking',
      modelsLoaded: false,
      notifications: [],
      unreadCount: 0,
      pollingInterval: 3000,
      apiUrl: import.meta.env.VITE_API_URL || window.location.origin,

      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setCurrentZone: (zone) => set({ currentZone: zone }),
      setBackendHealth: (healthy, status = 'ready', modelsLoaded = true) =>
        set({ isBackendHealthy: healthy, backendStatus: status, modelsLoaded }),

      addNotification: (n) => {
        const notification: Notification = {
          ...n,
          id: `notif-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        }
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 100),
          unreadCount: state.unreadCount + 1,
        }))
      },

      acknowledgeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, acknowledged: true } : n
          ),
          unreadCount: Math.max(0, get().unreadCount - 1),
        }))
      },

      clearAllNotifications: () => set({ notifications: [], unreadCount: 0 }),
      setPollingInterval: (ms) => set({ pollingInterval: ms }),
      setApiUrl: (url) => set({ apiUrl: url }),
    }),
    { name: 'sentinel-app-store', partialize: (s) => ({ mode: s.mode, theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, pollingInterval: s.pollingInterval, apiUrl: s.apiUrl }) }
  )
)
