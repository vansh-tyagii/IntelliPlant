import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useQuery } from '@tanstack/react-query'
import { incidentService } from '@/services/ragService'
import { scenarioService } from '@/services/scenarioService'

export interface PaletteItem {
  id: string
  type: 'nav' | 'zone' | 'action' | 'incident' | 'scenario'
  label: string
  description?: string
  icon?: string
  shortcut?: string
  action: () => void
}

const PLANT_ZONES = [
  { id: 'boiler-room', label: 'Boiler Room' },
  { id: 'machine-hall', label: 'Machine Hall' },
  { id: 'control-room', label: 'Control Room' },
  { id: 'assembly-line', label: 'Assembly Line' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'packing', label: 'Packing' },
  { id: 'chemical-storage', label: 'Chemical Storage' },
  { id: 'loading-bay', label: 'Loading Bay' },
  { id: 'utility-area', label: 'Utility Area' },
]

export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const setCurrentZone = useAppStore((s) => s.setCurrentZone)

  const { data: incidentsData } = useQuery({
    queryKey: ['incidents-palette'],
    queryFn: () => incidentService.getIncidents(5),
    staleTime: 60000,
  })

  const { data: scenariosData } = useQuery({
    queryKey: ['scenarios-palette'],
    queryFn: () => scenarioService.getScenarios(),
    staleTime: 300000,
  })

  const allItems = useMemo((): PaletteItem[] => {
    const nav: PaletteItem[] = [
      { id: 'nav-overview', type: 'nav', label: 'Overview', description: 'Executive Dashboard', icon: '📊', action: () => navigate('/overview') },
      { id: 'nav-plant', type: 'nav', label: 'Plant Digital Twin', description: 'Interactive plant heatmap', icon: '🏭', action: () => navigate('/plant') },
      { id: 'nav-operations', type: 'nav', label: 'Operations', description: 'Module controls and demo', icon: '⚙️', action: () => navigate('/operations') },
      { id: 'nav-ai', type: 'nav', label: 'AI Insights', description: 'Analytics and explainability', icon: '🤖', action: () => navigate('/ai-insights') },
      { id: 'nav-incidents', type: 'nav', label: 'Incidents', description: 'Incident intelligence', icon: '🚨', action: () => navigate('/incidents') },
      { id: 'nav-compliance', type: 'nav', label: 'Compliance', description: 'RAG safety assistant', icon: '📋', action: () => navigate('/compliance') },
      { id: 'nav-timeline', type: 'nav', label: 'Timeline', description: 'Plant event history', icon: '📅', action: () => navigate('/timeline') },
      { id: 'nav-system', type: 'nav', label: 'System Health', description: 'Backend and model status', icon: '💻', action: () => navigate('/system') },
      { id: 'nav-settings', type: 'nav', label: 'Settings', description: 'Theme, API, preferences', icon: '⚙️', action: () => navigate('/settings') },
    ]

    const zones: PaletteItem[] = PLANT_ZONES.map((z) => ({
      id: `zone-${z.id}`,
      type: 'zone',
      label: z.label,
      description: 'Open zone in Plant view',
      icon: '📍',
      action: () => {
        setCurrentZone(z.id)
        navigate('/plant')
        setOpen(false)
      },
    }))

    const incidents: PaletteItem[] = (incidentsData?.incidents || []).slice(0, 3).map((inc, i) => ({
      id: `incident-${i}`,
      type: 'incident',
      label: inc.summary || `Incident #${i + 1}`,
      description: inc.zone || inc.affected_zone || 'Unknown zone',
      icon: '⚠️',
      action: () => navigate('/incidents'),
    }))

    const scenarios: PaletteItem[] = (scenariosData?.scenarios || []).map((s) => ({
      id: `scenario-${s.scenario_id}`,
      type: 'scenario',
      label: s.name,
      description: `Load scenario: ${s.scenario_id}`,
      icon: '🎬',
      action: async () => {
        await scenarioService.loadScenario(s.scenario_id)
        setOpen(false)
      },
    }))

    return [...nav, ...zones, ...incidents, ...scenarios]
  }, [navigate, setCurrentZone, incidentsData, scenariosData])

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12)
    const q = query.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
    ).slice(0, 10)
  }, [query, allItems])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    if (e.key === 'Escape') setOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const close = () => { setOpen(false); setQuery('') }

  return { open, setOpen, close, query, setQuery, filtered }
}
