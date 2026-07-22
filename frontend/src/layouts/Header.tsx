import React, { useState, useEffect } from 'react'
import { Badge, Tooltip } from 'antd'
import { Bell, Monitor, AlertOctagon, User, Command } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { NotificationCenter } from '@/features/notifications/NotificationCenter'

interface HeaderProps {
  onOpenCommandPalette?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onOpenCommandPalette }) => {
  const { mode, setMode, isBackendHealthy, unreadCount } = useAppStore()
  const [time, setTime] = useState(new Date())
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-IN', { hour12: false })
  const dateStr = time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <header className="fixed top-0 right-0 h-16 flex items-center justify-between px-6 z-40 bg-[#10131c] border-b border-[#424656]"
        style={{ left: 'var(--sidebar-width, 280px)', transition: 'left 0.25s ease' }}>

        {/* Left: Title + mode badge */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-display font-semibold text-[#e1e2ee] text-base leading-tight">Sentinel Safety Platform</h1>
            <p className="font-mono text-[10px] text-[#8c90a1] tracking-[0.05em]">INDUSTRIAL AI INTELLIGENCE</p>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center bg-[#1d1f28] rounded border border-[#424656] p-0.5 gap-0.5">
            <button
              onClick={() => setMode('live')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                mode === 'live'
                  ? 'bg-[#93000a] text-[#ffdad6]'
                  : 'text-[#8c90a1] hover:text-[#e1e2ee]'
              }`}
            >
              {mode === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab] live-pulse" />}
              Live
            </button>
            <button
              onClick={() => setMode('demo')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                mode === 'demo'
                  ? 'bg-[#32143a] text-[#d187f0]'
                  : 'text-[#8c90a1] hover:text-[#e1e2ee]'
              }`}
            >
              {mode === 'demo' && <span className="w-1.5 h-1.5 rounded-full bg-[#9c27b0]" />}
              Demo
            </button>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-4">
          {/* Clock */}
          <div className="text-right hidden lg:block">
            <p className="font-mono text-[13px] text-[#b3c5ff] font-medium">{timeStr}</p>
            <p className="font-mono text-[10px] text-[#8c90a1]">{dateStr}</p>
          </div>

          <div className="h-6 w-px bg-[#424656]" />

          {/* Backend health */}
          <Tooltip title={isBackendHealthy ? 'Backend Connected' : 'Backend Offline'}>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
              isBackendHealthy ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isBackendHealthy ? 'bg-[#22c55e] live-pulse' : 'bg-[#ef4444]'}`} />
              {isBackendHealthy ? 'Connected' : 'Offline'}
            </div>
          </Tooltip>

          {/* Command palette */}
          <Tooltip title="Command Palette (Ctrl+K)">
            <button onClick={onOpenCommandPalette}
              className="p-2 text-[#8c90a1] hover:text-[#e1e2ee] hover:bg-[#272a33] rounded transition-colors">
              <Command size={16} />
            </button>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <button onClick={() => setNotifOpen(true)}
              className="p-2 text-[#8c90a1] hover:text-[#e1e2ee] hover:bg-[#272a33] rounded transition-colors relative">
              <Badge count={unreadCount} size="small" color="#0066ff" offset={[2, -2]}>
                <Bell size={16} className="text-[#8c90a1]" />
              </Badge>
            </button>
          </Tooltip>

          {/* Emergency */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#93000a] text-[#ffdad6] text-[10px] font-bold uppercase tracking-wider rounded hover:bg-[#b31217] transition-colors">
            <AlertOctagon size={12} />
            Emergency
          </button>

          {/* User */}
          <div className="w-8 h-8 rounded-full bg-[#0066ff] flex items-center justify-center cursor-pointer hover:bg-[#0052cc] transition-colors">
            <User size={14} className="text-white" />
          </div>

          {/* Live mode monitor */}
          {mode === 'live' && (
            <Tooltip title="Live monitoring active">
              <Monitor size={16} className="text-[#22c55e] live-pulse" />
            </Tooltip>
          )}
        </div>
      </header>

      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}
