import React, { useState, useRef, useEffect } from 'react'
import { Modal, Input } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, MapPin, Zap, AlertTriangle, Clapperboard, Navigation } from 'lucide-react'
import type { PaletteItem } from '@/hooks/useCommandPalette'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  nav: <Navigation size={14} className="text-[#b3c5ff]" />,
  zone: <MapPin size={14} className="text-[#22c55e]" />,
  action: <Zap size={14} className="text-[#f59e0b]" />,
  incident: <AlertTriangle size={14} className="text-[#ef4444]" />,
  scenario: <Clapperboard size={14} className="text-[#9c27b0]" />,
}

const TYPE_LABELS: Record<string, string> = {
  nav: 'Navigation', zone: 'Zone', action: 'Action', incident: 'Incident', scenario: 'Scenario',
}

interface CommandPaletteProps {
  open: boolean
  close: () => void
  query: string
  setQuery: (q: string) => void
  filtered: PaletteItem[]
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, close, query, setQuery, filtered }) => {
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<ReturnType<typeof Input.prototype.focus>>(null)

  useEffect(() => { if (open) setSelected(0) }, [open, query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      if (filtered[selected]) { filtered[selected].action(); close() }
    }
  }

  // Group by type
  const groups: Record<string, PaletteItem[]> = {}
  filtered.forEach((item) => {
    if (!groups[item.type]) groups[item.type] = []
    groups[item.type].push(item)
  })

  let globalIndex = 0

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      width={580}
      centered
      closable={false}
      styles={{
        mask: { backdropFilter: 'blur(4px)', background: 'rgba(11,14,22,0.7)' },
        body: { padding: 0, overflow: 'hidden' },
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#424656]">
          <Search size={16} className="text-[#8c90a1] shrink-0" />
          <input
            autoFocus
            ref={inputRef as React.Ref<HTMLInputElement>}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, zones, actions, incidents…"
            className="flex-1 bg-transparent text-[#e1e2ee] placeholder-[#8c90a1] outline-none font-sans text-sm"
          />
          <kbd className="font-mono text-[10px] text-[#8c90a1] bg-[#272a33] px-1.5 py-0.5 rounded border border-[#424656]">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          <AnimatePresence>
            {Object.entries(groups).map(([type, items]) => (
              <div key={type}>
                <div className="px-4 py-2 font-sans text-[9px] font-bold uppercase tracking-[0.05em] text-[#8c90a1] bg-[#0b0e16]">
                  {TYPE_LABELS[type] || type}
                </div>
                {items.map((item) => {
                  const idx = globalIndex++
                  const isSelected = idx === selected
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => { item.action(); close() }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-[#272a33]' : 'hover:bg-[#1d1f28]'
                      }`}
                    >
                      <span>{item.icon || TYPE_ICONS[item.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm text-[#e1e2ee] truncate">{item.label}</p>
                        {item.description && (
                          <p className="font-sans text-[11px] text-[#8c90a1] truncate">{item.description}</p>
                        )}
                      </div>
                      {isSelected && <ArrowRight size={14} className="text-[#b3c5ff] shrink-0" />}
                    </motion.button>
                  )
                })}
              </div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-[#8c90a1]">
              <Search size={24} />
              <p className="font-sans text-sm">No results for "{query}"</p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[#424656] px-4 py-2 flex gap-4 text-[10px] font-mono text-[#8c90a1]">
          <span><kbd className="bg-[#272a33] px-1 rounded border border-[#424656]">↑↓</kbd> navigate</span>
          <span><kbd className="bg-[#272a33] px-1 rounded border border-[#424656]">↵</kbd> open</span>
          <span><kbd className="bg-[#272a33] px-1 rounded border border-[#424656]">ESC</kbd> close</span>
        </div>
      </motion.div>
    </Modal>
  )
}
