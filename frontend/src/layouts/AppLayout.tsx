import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAppStore } from '@/store/appStore'
import { CommandPalette } from '@/features/commandPalette/CommandPalette'
import { SafetyCopilot } from '@/features/copilot/SafetyCopilot'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import { useAlerts } from '@/hooks/useAlerts'
import { useLiveMode } from '@/hooks/useLiveMode'

export const AppLayout: React.FC = () => {
  const { sidebarCollapsed, mode } = useAppStore()
  const palette = useCommandPalette()
  useBackendHealth()
  useAlerts()
  useLiveMode() // 3-second tick loop when mode === 'live'

  const sidebarWidth = sidebarCollapsed ? 64 : 280

  return (
    <div className={`flex h-screen overflow-hidden bg-[#10131c] ${mode === 'demo' ? 'demo-mode-active' : ''}`}>
      {/* CSS var for sidebar width */}
      <style>{`:root { --sidebar-width: ${sidebarWidth}px; }`}</style>

      <Sidebar />

      <div
        className="flex flex-col flex-1 h-screen overflow-hidden transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <Header onOpenCommandPalette={() => palette.setOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-[#10131c] pt-16">
          <Outlet />
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette {...palette} />
      <SafetyCopilot />
    </div>
  )
}
