import { useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboardService'
import { useAppStore } from '@/store/appStore'
import { useRuntimeStore } from '@/store/runtimeStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { AlertEntry } from '@/types/api'
import { notification } from 'antd'

export function useAlerts() {
  const mode = useAppStore((s) => s.mode)
  const addNotification = useAppStore((s) => s.addNotification)
  const setAlerts = useRuntimeStore((s) => s.setAlerts)
  const alerts = useRuntimeStore((s) => s.alerts)
  const prevCriticalCount = useRef(0)

  // WebSocket real-time alerts
  useWebSocket('/ws/alerts', {
    enabled: mode === 'live',
    onMessage: useCallback((data: unknown) => {
      const d = data as { data?: { alerts?: AlertEntry[] } }
      const incoming = d?.data?.alerts || []
      setAlerts(incoming)
      const criticals = incoming.filter((a) => a.risk_level === 'critical')
      if (criticals.length > prevCriticalCount.current) {
        criticals.slice(prevCriticalCount.current).forEach((a) => {
          notification.error({
            message: `🚨 Critical Alert — ${a.zone_name}`,
            description: a.message || a.description || 'Critical risk detected',
            duration: 8,
            placement: 'topRight',
          })
          addNotification({ type: 'error', title: `Critical — ${a.zone_name}`, message: a.message || 'Critical risk detected', zone_id: a.zone_id })
        })
      }
      prevCriticalCount.current = criticals.length
    }, [setAlerts, addNotification]),
  })

  // Polling fallback
  const query = useQuery({
    queryKey: ['alerts'],
    queryFn: () => dashboardService.getAlerts(),
    refetchInterval: mode === 'live' ? 10000 : 30000,
    select: (data) => data.alerts,
  })

  useEffect(() => {
    if (query.data) setAlerts(query.data)
  }, [query.data, setAlerts])

  const grouped = {
    critical: alerts.filter((a) => a.risk_level === 'critical'),
    warning: alerts.filter((a) => ['warning', 'high'].includes(a.risk_level || '')),
    // 'medium' is not a valid RiskLevel — fold into warning
    safe: alerts.filter((a) => a.risk_level === 'safe' || a.risk_level === 'normal'),
  }

  return { alerts, grouped, totalCount: alerts.length, isLoading: query.isLoading }
}
