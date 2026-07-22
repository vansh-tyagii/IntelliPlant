import React, { useState } from 'react'
import { Form, Select, Switch, Slider, Button, message, Input, Divider } from 'antd'
import { Settings as SettingsIcon, Save, RefreshCw, Info } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { setApiBaseUrl } from '@/services/api'

const POLLING_OPTIONS = [
  { label: '1 second', value: 1000 },
  { label: '3 seconds (recommended)', value: 3000 },
  { label: '5 seconds', value: 5000 },
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
]

export const Settings: React.FC = () => {
  const { mode, setMode, theme, setTheme, pollingInterval, setPollingInterval, apiUrl, setApiUrl } = useAppStore()
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    const normalizedUrl = localApiUrl.trim().replace(/\/$/, '')
    setApiUrl(normalizedUrl)
    setApiBaseUrl(normalizedUrl)
    message.success('Settings saved — restart may be required for API URL changes')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setLocalApiUrl(import.meta.env.VITE_API_URL || window.location.origin)
    setPollingInterval(3000)
    setMode('demo')
    message.info('Settings reset to defaults')
  }

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[rgba(140,144,161,0.15)] border border-[#8c90a1] flex items-center justify-center">
          <SettingsIcon size={18} className="text-[#8c90a1]" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">Settings</h2>
          <p className="font-sans text-xs text-[#8c90a1]">Platform configuration and preferences</p>
        </div>
      </div>

      {/* General */}
      <div className="bg-[#191b24] border border-[#424656] p-5 space-y-5">
        <h3 className="font-display font-semibold text-sm text-[#e1e2ee]">General</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans text-sm text-[#e1e2ee]">Platform Mode</p>
            <p className="font-sans text-xs text-[#8c90a1]">Demo: manual step-by-step · Live: 3-second auto-cycle</p>
          </div>
          <Select
            value={mode}
            onChange={(v) => setMode(v)}
            options={[{ value: 'demo', label: '🎬 Demo Mode' }, { value: 'live', label: '🔴 Live Mode' }]}
            style={{ width: 160 }}
          />
        </div>

        <Divider style={{ borderColor: '#272a33', margin: '8px 0' }} />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans text-sm text-[#e1e2ee]">Theme</p>
            <p className="font-sans text-xs text-[#8c90a1]">Dark is primary per design system</p>
          </div>
          <Select
            value={theme}
            onChange={(v) => setTheme(v)}
            options={[{ value: 'dark', label: '🌑 Dark (recommended)' }, { value: 'light', label: '☀️ Light' }]}
            style={{ width: 200 }}
          />
        </div>
      </div>

      {/* Performance */}
      <div className="bg-[#191b24] border border-[#424656] p-5 space-y-5">
        <h3 className="font-display font-semibold text-sm text-[#e1e2ee]">Performance</h3>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-sans text-sm text-[#e1e2ee]">Live Polling Interval</p>
              <p className="font-sans text-xs text-[#8c90a1]">How often the frontend polls the backend in Live mode</p>
            </div>
            <span className="font-mono text-sm text-[#b3c5ff]">{pollingInterval / 1000}s</span>
          </div>
          <Select
            value={pollingInterval}
            onChange={setPollingInterval}
            options={POLLING_OPTIONS}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* API Connection */}
      <div className="bg-[#191b24] border border-[#424656] p-5 space-y-5">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-sm text-[#e1e2ee]">API Connection</h3>
          <div className="flex items-center gap-1 bg-[rgba(245,158,11,0.15)] border border-[#f59e0b] text-[#f59e0b] px-2 py-0.5 rounded">
            <Info size={10} />
            <span className="font-mono text-[9px] uppercase tracking-wider">Restart required</span>
          </div>
        </div>

        <div>
          <p className="font-sans text-xs text-[#8c90a1] mb-2">Backend API URL</p>
          <Input
            value={localApiUrl}
            onChange={(e) => setLocalApiUrl(e.target.value)}
            placeholder="http://localhost:8000"
            prefix={<span className="font-mono text-[10px] text-[#8c90a1]">URL</span>}
          />
          <p className="font-mono text-[9px] text-[#424656] mt-1">
            Current: {apiUrl} · WebSocket: {apiUrl.replace(/^http/, 'ws')}
          </p>
        </div>
      </div>

      {/* About */}
      <div className="bg-[#191b24] border border-[#424656] p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm text-[#e1e2ee]">About</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Platform', value: 'Sentinel Safety Intelligence' },
            { label: 'Version', value: '3.2.1-PRO' },
            { label: 'Frontend', value: 'React 19 + Vite + Ant Design' },
            { label: 'Backend', value: 'FastAPI + Multi-Agent AI' },
            { label: 'AI Modules', value: 'AI4I 2020 · SWAT LSTM · PPE CV · Fusion' },
            { label: 'Compliance', value: 'OISD · Factories Act · DGMS · IS Standards' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">{item.label}</span>
              <span className="font-sans text-xs text-[#c2c6d8]">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button icon={<RefreshCw size={14} />} onClick={handleReset}>
          Reset to Defaults
        </Button>
        <Button
          type="primary"
          icon={<Save size={14} />}
          onClick={handleSave}
          loading={saved}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
