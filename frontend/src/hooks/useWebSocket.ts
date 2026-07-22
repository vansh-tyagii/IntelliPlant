import { useEffect, useRef, useCallback } from 'react'
import { getWsBaseUrl } from '@/services/api'

interface UseWebSocketOptions {
  onMessage: (data: unknown) => void
  onError?: (error: Event) => void
  reconnectInterval?: number
  enabled?: boolean
}

export function useWebSocket(path: string, options: UseWebSocketOptions) {
  const { onMessage, onError, reconnectInterval = 3000, enabled = true } = options
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return
    try {
      const ws = new WebSocket(`${getWsBaseUrl()}${path}`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try { onMessage(JSON.parse(e.data)) } catch { onMessage(e.data) }
      }
      ws.onerror = (e) => { onError?.(e) }
      ws.onclose = () => {
        if (mountedRef.current) {
          timerRef.current = setTimeout(connect, reconnectInterval)
        }
      }
    } catch {
      timerRef.current = setTimeout(connect, reconnectInterval)
    }
  }, [path, enabled, reconnectInterval, onMessage, onError])

  useEffect(() => {
    mountedRef.current = true
    if (enabled) connect()
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect, enabled])

  return { ws: wsRef.current }
}
