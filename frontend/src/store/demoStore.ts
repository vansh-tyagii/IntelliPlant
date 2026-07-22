import { create } from 'zustand'
import type { Ai4iInput, Ai4iResult, SwatResult, PpeResult, FusionResult, Incident } from '@/types/api'

export type DemoStep = 0 | 1 | 2 | 3 | 4 | 5 | 6

interface DemoState {
  // Step tracking
  wizardStep: DemoStep
  wizardOpen: boolean
  stepsCompleted: boolean[] // index 0 = AI4I, 1 = SWAT, 2 = PPE, 3 = Fusion, 4 = Incident, 5 = RAG

  // Inputs
  selectedZone: string
  ai4iInput: Ai4iInput | null
  swatReadingIndex: number
  ppeUploadedFile: File | null
  selectedScenario: string | null

  // Results
  ai4iResult: Ai4iResult | null
  swatResult: SwatResult | null
  ppeResult: PpeResult | null
  fusionResult: FusionResult | null
  incidentResult: Incident | null
  recommendationResult: Record<string, unknown> | null

  // Running state per step
  stepRunning: boolean

  // Actions
  setWizardOpen: (open: boolean) => void
  setWizardStep: (step: DemoStep) => void
  nextStep: () => void
  prevStep: () => void
  markStepComplete: (stepIndex: number, result?: unknown) => void
  setSelectedZone: (zone: string) => void
  setAi4iInput: (input: Ai4iInput) => void
  setSwatReadingIndex: (idx: number) => void
  setPpeFile: (file: File | null) => void
  setSelectedScenario: (s: string | null) => void
  setAi4iResult: (r: Ai4iResult) => void
  setSwatResult: (r: SwatResult) => void
  setPpeResult: (r: PpeResult) => void
  setFusionResult: (r: FusionResult) => void
  setIncidentResult: (r: Incident) => void
  setRecommendationResult: (r: Record<string, unknown>) => void
  setStepRunning: (running: boolean) => void
  resetDemo: () => void
}

const defaultAi4iInput: Ai4iInput = {
  air_temp: 298.1,
  process_temp: 308.6,
  rpm: 1551,
  torque: 42.8,
  tool_wear: 0,
  machine_type: 'M',
}

export const useDemoStore = create<DemoState>()((set, get) => ({
  wizardStep: 0,
  wizardOpen: false,
  stepsCompleted: [false, false, false, false, false, false],
  selectedZone: 'machine-hall',
  ai4iInput: defaultAi4iInput,
  swatReadingIndex: 0,
  ppeUploadedFile: null,
  selectedScenario: null,
  ai4iResult: null,
  swatResult: null,
  ppeResult: null,
  fusionResult: null,
  incidentResult: null,
  recommendationResult: null,
  stepRunning: false,

  setWizardOpen: (open) => set({ wizardOpen: open }),
  setWizardStep: (step) => set({ wizardStep: step }),
  nextStep: () => set((s) => ({ wizardStep: Math.min(6, s.wizardStep + 1) as DemoStep })),
  prevStep: () => set((s) => ({ wizardStep: Math.max(0, s.wizardStep - 1) as DemoStep })),

  markStepComplete: (stepIndex) => {
    const steps = [...get().stepsCompleted]
    steps[stepIndex] = true
    set({ stepsCompleted: steps })
  },

  setSelectedZone: (zone) => set({ selectedZone: zone }),
  setAi4iInput: (input) => set({ ai4iInput: input }),
  setSwatReadingIndex: (idx) => set({ swatReadingIndex: idx }),
  setPpeFile: (file) => set({ ppeUploadedFile: file }),
  setSelectedScenario: (s) => set({ selectedScenario: s }),
  setAi4iResult: (r) => set({ ai4iResult: r }),
  setSwatResult: (r) => set({ swatResult: r }),
  setPpeResult: (r) => set({ ppeResult: r }),
  setFusionResult: (r) => set({ fusionResult: r }),
  setIncidentResult: (r) => set({ incidentResult: r }),
  setRecommendationResult: (r) => set({ recommendationResult: r }),
  setStepRunning: (running) => set({ stepRunning: running }),

  resetDemo: () =>
    set({
      wizardStep: 0,
      stepsCompleted: [false, false, false, false, false, false],
      ai4iInput: defaultAi4iInput,
      swatReadingIndex: 0,
      ppeUploadedFile: null,
      selectedScenario: null,
      ai4iResult: null,
      swatResult: null,
      ppeResult: null,
      fusionResult: null,
      incidentResult: null,
      recommendationResult: null,
      stepRunning: false,
    }),
}))
