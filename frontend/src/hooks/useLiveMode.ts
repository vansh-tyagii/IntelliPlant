/**
 * useLiveMode — implements the Live Mode tick loop.
 *
 * When mode === 'live', this hook:
 *  1. Calls POST /api/live/start-all to initialize SWAT LSTM + AI4I sessions
 *     for all zones (one-time; idempotent if already started).
 *  2. Every `pollingInterval` ms, calls POST /api/live/tick/{zone} in parallel
 *     for all zones, extracts real AI4I / SWAT / PPE / Fusion results,
 *     and writes them into the runtimeStore.
 *  3. Invalidates React Query caches for heatmap / alerts / zones.
 *
 * In Demo Mode this hook does nothing — all inference is manual via DemoWizard.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/appStore'
import { useRuntimeStore } from '@/store/runtimeStore'
import { liveService } from '@/services/liveService'
import type { LiveTickResult } from '@/types/api'

const ZONES = [
  'boiler-room', 'machine-hall', 'control-room', 'assembly-line', 'warehouse',
  'maintenance', 'packing', 'chemical-storage', 'loading-bay', 'utility-area',
]

export function useLiveMode() {
  const mode = useAppStore((s) => s.mode)
  const pollingInterval = useAppStore((s) => s.pollingInterval)
  const { updateAi4i, updateSwat, updatePpe, updateFusion, appendTimelineEvent, incrementCycle } = useRuntimeStore()
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickingRef = useRef(false)     // prevent overlap on slow ticks
  const startedRef = useRef(false)     // track if start-all has been called

  /** Start live sessions for all zones (idempotent). */
  const ensureStarted = useCallback(async () => {
    if (startedRef.current) return
    try {
      await liveService.startAllLive({ interval_seconds: 3 })
      startedRef.current = true
      console.info('[useLiveMode] Live sessions started for all zones.')
    } catch (err) {
      // start-all may time out on slow machines (SWAT loads TF once per zone).
      // Mark as started anyway — tick() handles individual 400 errors gracefully.
      startedRef.current = true
      console.warn('[useLiveMode] start-all timed out or failed, ticking will re-attempt:', err)
    }
  }, [])

  const runTick = useCallback(async () => {
    if (tickingRef.current) return
    tickingRef.current = true
    try {
      // Ensure sessions are started before first tick
      await ensureStarted()

      // Fire ticks for all zones in parallel
      const promises = ZONES.map(async (zone) => {
        try {
          const data: LiveTickResult = await liveService.tickLive(zone)
          const r = data.results || {}

          if (r.ai4i) updateAi4i(zone, r.ai4i)
          if (r.swat) updateSwat(zone, r.swat)
          if (r.ppe) updatePpe(zone, r.ppe)
          if (r.fusion) updateFusion(zone, r.fusion)

          // Append a timeline event for fusion ticks
          if (r.fusion) {
            appendTimelineEvent({
              timestamp: new Date().toISOString(),
              source: 'fusion',
              zone_id: zone,
              zone_name: zone.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              risk_level: (r.fusion.raw?.risk_level?.toLowerCase() ?? r.fusion.status ?? 'normal') as 'normal',
              message: `Live tick — ${r.fusion.raw?.risk_level ?? r.fusion.status ?? 'safe'}`,
            })
          }
        } catch {
          // Individual zone tick failure is non-fatal — log silently and continue
        }
      })

      await Promise.all(promises)
      incrementCycle()

      // Invalidate React Query caches so UI components re-fetch fresh data
      queryClient.invalidateQueries({ queryKey: ['heatmap'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      queryClient.invalidateQueries({ queryKey: ['plant-heatmap'] })
      queryClient.invalidateQueries({ queryKey: ['zones-list'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } finally {
      tickingRef.current = false
    }
  }, [ensureStarted, updateAi4i, updateSwat, updatePpe, updateFusion, appendTimelineEvent, incrementCycle, queryClient])

  useEffect(() => {
    if (mode !== 'live') {
      // Stop tick loop when leaving live mode
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      // Reset started flag so next live-mode activation re-starts sessions
      startedRef.current = false
      return
    }

    // Run immediately on mode switch, then on interval
    runTick()
    timerRef.current = setInterval(runTick, pollingInterval)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [mode, pollingInterval, runTick])
}
