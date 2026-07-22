import React, { useState } from 'react'
import { Input, Button, Spin, Select, Divider, Tooltip, Alert } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { Send, Copy, ShieldCheck } from 'lucide-react'
import { ragService } from '@/services/ragService'
import { RagReferenceCard, parseReferences } from '@/features/compliance/RagReferenceCard'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

const PRESET_QUESTIONS = [
  'What PPE is required for boiler room operations under OISD?',
  'What are the Factories Act requirements for gas leak emergency response?',
  'List DGMS regulations for coal handling safety.',
  'What is the shutdown procedure for a heat exchanger failure?',
  'What OISD standard applies to pressure vessel inspection intervals?',
]

const ZONES = ['default', 'boiler-room', 'machine-hall', 'control-room', 'assembly-line', 'warehouse', 'maintenance', 'packing', 'chemical-storage', 'loading-bay', 'utility-area']

interface QAEntry {
  question: string
  answer: string
  references: { source: string; excerpt: string }[]
  zone: string
  timestamp: string
}

export const Compliance: React.FC = () => {
  const [question, setQuestion] = useState('')
  const [zone, setZone] = useState('default')
  const [history, setHistory] = useState<QAEntry[]>([])

  const askMutation = useMutation({
    mutationFn: () => ragService.askCompliance(question, zone),
    onSuccess: (data) => {
      // Backend answer may be null when FAISS index is missing.
      // Fall back to raw.answer, then context_used, then show error message.
      const rawAnswer = data?.raw?.answer
      const topAnswer = data?.answer
      const contextUsed = data?.context_used || data?.raw?.context_used
      const ragError = data?.raw?.error

      let answer: string
      if (topAnswer) {
        answer = topAnswer
      } else if (rawAnswer) {
        answer = rawAnswer
      } else if (ragError) {
        answer = `⚠️ RAG knowledge base is unavailable (FAISS index missing).\n\nContext used for this zone:\n${contextUsed || 'No context available.'}\n\nError: ${ragError}`
      } else {
        answer = contextUsed ? `Context: ${contextUsed}` : JSON.stringify(data)
      }

      const references = parseReferences(answer)
      setHistory((prev) => [{
        question,
        answer,
        references,
        zone,
        timestamp: new Date().toISOString(),
      }, ...prev])
      setQuestion('')
    },
  })

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[rgba(34,197,94,0.15)] border border-[#22c55e] flex items-center justify-center">
          <ShieldCheck size={18} className="text-[#22c55e]" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-2xl text-[#e1e2ee]">Compliance Assistant</h2>
          <p className="font-sans text-xs text-[#8c90a1]">
            RAG-powered regulatory Q&A · OISD · Factories Act · DGMS · IS Standards
          </p>
        </div>
      </div>

      {/* Question input */}
      <div className="bg-[#191b24] border border-[#424656] p-5 space-y-4">
        <div className="flex gap-3">
          <Select
            value={zone}
            onChange={setZone}
            options={ZONES.map((z) => ({ value: z, label: z.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))}
            style={{ width: 180 }}
            placeholder="Zone context"
          />
          <Input.TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); askMutation.mutate() } }}
            placeholder="Ask about safety regulations, PPE requirements, emergency procedures…"
            rows={2}
            className="flex-1"
          />
          <Button
            type="primary"
            icon={<Send size={14} />}
            onClick={() => askMutation.mutate()}
            loading={askMutation.isPending}
            disabled={!question.trim()}
            style={{ height: 'auto' }}
          >
            Ask
          </Button>
        </div>

        {/* Preset questions */}
        <div className="flex flex-wrap gap-2">
          {PRESET_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => setQuestion(q)}
              className="font-sans text-[10px] px-2.5 py-1 bg-[#272a33] border border-[#424656] text-[#c2c6d8] hover:border-[#b3c5ff] hover:text-[#b3c5ff] rounded transition-colors">
              {q.slice(0, 50)}{q.length > 50 ? '…' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {askMutation.isPending && (
        <div className="flex items-center gap-3 bg-[#191b24] border border-[#424656] p-4">
          <Spin size="small" />
          <p className="font-sans text-sm text-[#c2c6d8]">Searching regulatory knowledge base…</p>
        </div>
      )}
      {askMutation.isError && (
        <Alert type="error" showIcon message="Compliance request failed" description={(askMutation.error as Error).message} />
      )}

      {/* Q&A History */}
      {history.map((entry, i) => (
        <ErrorBoundary key={i} moduleName="Compliance Answer">
          <div className="bg-[#191b24] border border-[#424656] overflow-hidden fade-in">
            {/* Question */}
            <div className="bg-[#191b24] px-5 py-3 border-b border-[#272a33]">
              <div className="flex items-start justify-between gap-2">
                <p className="font-sans text-sm font-semibold text-[#b3c5ff]">❓ {entry.question}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[9px] text-[#8c90a1]">{entry.zone} · {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour12: false })}</span>
                  <Tooltip title="Copy answer">
                    <Button type="text" size="small" icon={<Copy size={12} />} onClick={() => handleCopy(entry.answer)} className="text-[#8c90a1]" />
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Answer */}
            <div className="px-5 py-4">
              <p className="font-sans text-sm text-[#c2c6d8] leading-relaxed whitespace-pre-wrap">{entry.answer}</p>
            </div>

            {/* References */}
            {entry.references.length > 0 && (
              <>
                <Divider style={{ borderColor: '#272a33', margin: 0 }} />
                <div className="px-5 py-4 space-y-3">
                  <p className="font-mono text-[9px] text-[#8c90a1] uppercase tracking-wider">Regulatory References</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {entry.references.map((ref, j) => (
                      <RagReferenceCard key={j} source={ref.source} excerpt={ref.excerpt} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ErrorBoundary>
      ))}

      {history.length === 0 && !askMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <ShieldCheck size={48} className="text-[#424656]" />
          <div className="w-full max-w-md">
            <p className="font-display font-semibold text-[#e1e2ee]">Ask the Compliance Assistant</p>
            <p className="font-sans text-sm text-[#8c90a1] mt-1 max-w-md">
              Get instant answers on OISD, Factory Act, DGMS and IS Standards. References are automatically extracted and displayed as cards.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
