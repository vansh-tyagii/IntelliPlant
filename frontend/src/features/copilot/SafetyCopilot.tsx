import React, { useState, useRef, useEffect } from 'react'
import { Drawer, Button, Input, Spin } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Send, X, Minimize2 } from 'lucide-react'
import { agentService } from '@/services/ragService'
import { useAppStore } from '@/store/appStore'
import { useRuntimeStore } from '@/store/runtimeStore'
import type { ChatMessage } from '@/types/api'

export const SafetyCopilot: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm the Safety Copilot. Ask me about plant safety, zone risks, compliance requirements, or any incident.\n\nTry: *\"Why is Zone B critical?\"* or *\"What PPE is required for maintenance?\"*",
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const currentZone = useAppStore((s) => s.currentZone)
  const fusionResults = useRuntimeStore((s) => s.fusionResults)
  const hasAlert = useRuntimeStore((s) => s.alerts.some((a) => a.risk_level === 'critical'))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const context: Record<string, unknown> = { zone: currentZone || 'default' }
      if (currentZone && fusionResults[currentZone]) context.fusion = fusionResults[currentZone]
      const res = await agentService.chatWithCopilot(input.trim(), context)
      const answer = res?.answer
      if (!answer) throw new Error('The backend returned no copilot answer.')
      setMessages((prev) => [...prev, { role: 'assistant', content: answer, timestamp: new Date().toISOString() }])
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Backend request failed: ${error instanceof Error ? error.message : 'Unknown error'}. Retry your question after checking system health.`,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#0066ff] text-white shadow-lg flex items-center justify-center transition-all ${
          hasAlert ? 'ring-2 ring-[#f59e0b] ring-offset-2 ring-offset-[#10131c]' : ''
        }`}
        title="Ask Safety Copilot"
      >
        <Shield size={24} />
        {hasAlert && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f59e0b] rounded-full live-pulse" />
        )}
      </motion.button>

      {/* Chat Drawer */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        width={440}
        closable={false}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0066ff] flex items-center justify-center">
                <Shield size={14} className="text-white" />
              </div>
              <div>
                <p className="font-display font-semibold text-sm text-[#e1e2ee]">Safety Copilot</p>
                <p className="font-mono text-[9px] text-[#8c90a1] tracking-wider">AI ASSISTANT</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button type="text" size="small" icon={<Minimize2 size={14} />} onClick={() => setOpen(false)} className="text-[#8c90a1]" />
              <Button type="text" size="small" icon={<X size={14} />} onClick={() => setOpen(false)} className="text-[#8c90a1]" />
            </div>
          </div>
        }
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded p-3 ${
                  msg.role === 'user'
                    ? 'bg-[#0066ff] text-white'
                    : 'bg-[#272a33] text-[#e1e2ee] border border-[#424656]'
                }`}>
                  <p className="font-sans text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="font-mono text-[9px] mt-1.5 opacity-50">
                    {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#272a33] border border-[#424656] rounded p-3 flex items-center gap-2">
                <Spin size="small" />
                <span className="font-sans text-xs text-[#8c90a1]">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#424656] p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={send}
            placeholder="Ask about safety, risk, compliance…"
            disabled={loading}
            className="flex-1"
          />
          <Button
            type="primary"
            icon={<Send size={14} />}
            onClick={send}
            disabled={loading || !input.trim()}
          />
        </div>

        {currentZone && (
          <div className="px-3 pb-2">
            <p className="font-mono text-[9px] text-[#8c90a1] tracking-wider">
              CONTEXT: {currentZone.toUpperCase()}
            </p>
          </div>
        )}
      </Drawer>
    </>
  )
}
