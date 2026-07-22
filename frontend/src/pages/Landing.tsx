import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, CheckCircle, XCircle, Loader2, ArrowRight, Shield, Activity } from 'lucide-react'
import { healthService } from '@/services/healthService'
import { useAppStore } from '@/store/appStore'

interface CheckItem {
  label: string
  status: 'checking' | 'ok' | 'error'
  detail?: string
}

export const Landing: React.FC = () => {
  const navigate = useNavigate()
  const { setBackendHealth } = useAppStore()
  const [checks, setChecks] = useState<CheckItem[]>([
    { label: 'Backend Connected', status: 'checking' },
    { label: 'Models Loaded', status: 'checking' },
    { label: 'System Ready', status: 'checking' },
    { label: 'Runtime Status', status: 'checking' },
  ])
  const [allOk, setAllOk] = useState(false)
  const [hasError, setHasError] = useState(false)

  const update = (i: number, status: CheckItem['status'], detail?: string) =>
    setChecks((prev) => prev.map((c, idx) => (idx === i ? { ...c, status, detail } : c)))

  useEffect(() => {
    const run = async () => {
      try {
        const root = await healthService.getRoot()
        update(0, 'ok', root.status)
      } catch {
        update(0, 'error', 'Connection refused')
        setChecks((prev) =>
          prev.map((c) => (c.status === 'checking' ? { ...c, status: 'error', detail: 'Skipped' } : c))
        )
        setHasError(true)
        return
      }

      await new Promise((r) => setTimeout(r, 350))

      try {
        const status = await healthService.getStatus()
        const agentCount = (status.agents || []).length
        update(1, 'ok', `${agentCount} agents active`)
        setBackendHealth(true, status.status, true)
      } catch {
        update(1, 'error', 'Could not load agents')
      }

      await new Promise((r) => setTimeout(r, 350))

      try {
        const health = await healthService.getSystemHealth()
        update(2, 'ok', `Uptime: ${Math.round(health.uptime_seconds)}s`)
      } catch {
        update(2, 'error', 'Health check failed')
      }

      await new Promise((r) => setTimeout(r, 280))

      try {
        const modules = await healthService.getRuntimeModules()
        const count = modules.known_modules?.length || 0
        update(3, 'ok', `${count} modules online`)
      } catch {
        update(3, 'ok', 'Runtime active')
      }

      setAllOk(true)
    }
    run()
  }, [setBackendHealth])

  return (
    <div className="min-h-screen w-full bg-[#0b0e16] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#b3c5ff 1px, transparent 1px), linear-gradient(90deg, #b3c5ff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow behind card */}
      <div
        className="absolute w-[600px] h-[400px] rounded-full opacity-10 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #0066ff 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full"
        style={{ maxWidth: 480 }}
      >
        {/* Logo + wordmark */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-[#0066ff] flex items-center justify-center shadow-2xl shadow-blue-900/60 shrink-0">
            <Zap size={28} className="text-white" />
          </div>
          <div>
            <h1
              className="text-[#e1e2ee] font-semibold leading-tight"
              style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 26 }}
            >
              Sentinel Safety
            </h1>
            <p
              className="text-[#8c90a1] tracking-[0.15em] uppercase mt-0.5"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}
            >
              Industrial AI Platform
            </p>
          </div>
        </div>

        {/* Health check card */}
        <div className="bg-[#1d1f28] border border-[#424656] rounded-xl p-6 mb-5">
          <p
            className="text-[#8c90a1] uppercase tracking-[0.08em] mb-6"
            style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700 }}
          >
            System Initialization
          </p>

          <div className="space-y-5">
            {checks.map((check, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3"
              >
                {/* Status icon */}
                <div className="shrink-0 w-5 flex items-center justify-center">
                  {check.status === 'checking' && (
                    <Loader2 size={16} className="text-[#b3c5ff] animate-spin" />
                  )}
                  {check.status === 'ok' && (
                    <CheckCircle size={16} className="text-[#22c55e]" />
                  )}
                  {check.status === 'error' && (
                    <XCircle size={16} className="text-[#ef4444]" />
                  )}
                </div>

                {/* Label + detail */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[#e1e2ee]"
                    style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500 }}
                  >
                    {check.label}
                  </p>
                  {check.detail && (
                    <p
                      className="text-[#8c90a1] mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}
                    >
                      {check.detail}
                    </p>
                  )}
                </div>

                {/* Status pill */}
                <div
                  className="shrink-0 px-2 py-0.5 rounded"
                  style={{
                    background:
                      check.status === 'ok'
                        ? 'rgba(34,197,94,0.12)'
                        : check.status === 'error'
                        ? 'rgba(239,68,68,0.12)'
                        : 'rgba(179,197,255,0.08)',
                    border: `1px solid ${
                      check.status === 'ok'
                        ? '#22c55e40'
                        : check.status === 'error'
                        ? '#ef444440'
                        : '#b3c5ff20'
                    }`,
                  }}
                >
                  <span
                    className="uppercase tracking-wider"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      color:
                        check.status === 'ok'
                          ? '#22c55e'
                          : check.status === 'error'
                          ? '#ef4444'
                          : '#b3c5ff',
                    }}
                  >
                    {check.status === 'checking' ? 'CHECKING' : check.status === 'ok' ? 'READY' : 'ERROR'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <AnimatePresence>
          {allOk && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => navigate('/overview')}
              className="w-full rounded-xl py-4 flex flex-row items-center justify-center gap-3 text-white font-semibold text-base transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                background: 'linear-gradient(135deg, #0066ff 0%, #004ecc 100%)',
                boxShadow: '0 8px 32px rgba(0,102,255,0.35)',
              }}
            >
              <Shield size={18} />
              Enter Command Center
              <ArrowRight size={18} />
            </motion.button>
          )}

          {hasError && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => window.location.reload()}
              className="w-full border border-[#424656] text-[#c2c6d8] rounded-xl py-4 flex flex-row items-center justify-center gap-2 hover:bg-[#272a33] transition-colors font-medium text-sm"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Retry Connection
            </motion.button>
          )}
        </AnimatePresence>

        {/* Feature strip */}
        {allOk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-6 mt-6"
          >
            {[
              { icon: <Activity size={12} />, label: '10 Zones' },
              { icon: <Shield size={12} />, label: '8 AI Agents' },
              { icon: <Zap size={12} />, label: 'Live Fusion' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-[#8c90a1]">
                {item.icon}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                  {item.label}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        <p
          className="text-center text-[#424656] mt-6"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}
        >
          v3.2.1-PRO · ETAI Industrial AI Platform
        </p>
      </motion.div>
    </div>
  )
}
