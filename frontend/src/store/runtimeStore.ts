import { create } from 'zustand'
import type { Ai4iResult, SwatResult, PpeResult, FusionResult, TimelineEvent, Incident, LiveStatus, AlertEntry } from '@/types/api'

interface RuntimeState {
  ai4iResults: Record<string, Ai4iResult>
  swatResults: Record<string, SwatResult>
  ppeResults: Record<string, PpeResult>
  fusionResults: Record<string, FusionResult>
  timelineEvents: TimelineEvent[]
  incidents: Incident[]
  alerts: AlertEntry[]
  liveSessionStatus: Record<string, LiveStatus>
  lastCycleTime: string | null
  cycleCount: number

  // Actions
  updateAi4i: (zone: string, result: Ai4iResult) => void
  updateSwat: (zone: string, result: SwatResult) => void
  updatePpe: (zone: string, result: PpeResult) => void
  updateFusion: (zone: string, result: FusionResult) => void
  appendTimelineEvent: (event: TimelineEvent) => void
  setTimelineEvents: (events: TimelineEvent[]) => void
  setIncidents: (incidents: Incident[]) => void
  prependIncident: (incident: Incident) => void
  setAlerts: (alerts: AlertEntry[]) => void
  setLiveStatus: (zone: string, status: LiveStatus) => void
  incrementCycle: () => void
  resetZone: (zone: string) => void
}

export const useRuntimeStore = create<RuntimeState>()((set) => ({
  ai4iResults: {},
  swatResults: {},
  ppeResults: {},
  fusionResults: {},
  timelineEvents: [],
  incidents: [],
  alerts: [],
  liveSessionStatus: {},
  lastCycleTime: null,
  cycleCount: 0,

  updateAi4i: (zone, result) =>
    set((s) => ({ ai4iResults: { ...s.ai4iResults, [zone]: result } })),

  updateSwat: (zone, result) =>
    set((s) => ({ swatResults: { ...s.swatResults, [zone]: result } })),

  updatePpe: (zone, result) =>
    set((s) => ({ ppeResults: { ...s.ppeResults, [zone]: result } })),

  updateFusion: (zone, result) =>
    set((s) => ({ fusionResults: { ...s.fusionResults, [zone]: result } })),

  appendTimelineEvent: (event) =>
    set((s) => ({ timelineEvents: [event, ...s.timelineEvents].slice(0, 500) })),

  setTimelineEvents: (events) => set({ timelineEvents: events }),

  setIncidents: (incidents) => set({ incidents }),

  prependIncident: (incident) =>
    set((s) => ({ incidents: [incident, ...s.incidents].slice(0, 50) })),

  setAlerts: (alerts) => set({ alerts }),

  setLiveStatus: (zone, status) =>
    set((s) => ({ liveSessionStatus: { ...s.liveSessionStatus, [zone]: status } })),

  incrementCycle: () =>
    set((s) => ({ cycleCount: s.cycleCount + 1, lastCycleTime: new Date().toISOString() })),

  resetZone: (zone) =>
    set((s) => {
      const ai4i = { ...s.ai4iResults }
      const swat = { ...s.swatResults }
      const ppe = { ...s.ppeResults }
      const fusion = { ...s.fusionResults }
      delete ai4i[zone]; delete swat[zone]; delete ppe[zone]; delete fusion[zone]
      return { ai4iResults: ai4i, swatResults: swat, ppeResults: ppe, fusionResults: fusion }
    }),
}))
