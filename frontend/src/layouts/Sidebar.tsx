import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/appStore'
import {
  LayoutDashboard, Factory, Settings2, Brain, AlertTriangle,
  ShieldCheck, Clock, Activity, Settings, ChevronLeft, ChevronRight, Zap
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard },
  { path: '/plant', label: 'Plant Twin', icon: Factory },
  { path: '/operations', label: 'Operations', icon: Settings2 },
  { path: '/ai-insights', label: 'AI Insights', icon: Brain },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { path: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { path: '/timeline', label: 'Timeline', icon: Clock },
  { path: '/system', label: 'System', icon: Activity },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export const Sidebar: React.FC = () => {
  const location = useLocation()
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 280 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full flex flex-col border-r border-[#424656] bg-[#191b24] z-50 overflow-hidden"
      style={{ minWidth: sidebarCollapsed ? 64 : 280 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#424656] bg-[#0b0e16] shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[#0066ff] flex items-center justify-center shrink-0">
          <Zap size={18} className="text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <p className="text-[#e1e2ee] font-display font-semibold text-sm leading-tight whitespace-nowrap">Sentinel Safety</p>
              <p className="text-[#8c90a1] font-mono text-[10px] tracking-widest">v3.2.1-PRO</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path || (path !== '/overview' && location.pathname.startsWith(path))
          return (
            <Link
              key={path}
              to={path}
              title={sidebarCollapsed ? label : undefined}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 relative group
                ${active
                  ? 'text-[#b3c5ff] bg-[#272a33] border-l-2 border-[#0066ff]'
                  : 'text-[#8c90a1] hover:text-[#e1e2ee] hover:bg-[#1d1f28] border-l-2 border-transparent hover:translate-x-0.5'
                }`}
            >
              <Icon size={18} className="shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="font-sans text-xs font-semibold uppercase tracking-[0.05em] whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {sidebarCollapsed && (
                <div className="absolute left-16 bg-[#272a33] border border-[#424656] text-[#e1e2ee] text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[#424656] p-2">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center py-2 text-[#8c90a1] hover:text-[#e1e2ee] hover:bg-[#272a33] rounded transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </motion.aside>
  )
}
