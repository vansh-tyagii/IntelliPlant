import React, { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props { children: ReactNode; fallback?: ReactNode; moduleName?: string }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="bg-[#191b24] border border-[#424656] p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[120px]">
        <AlertTriangle size={24} className="text-[#f59e0b]" />
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#f59e0b] mb-1">
            {this.props.moduleName || 'Module'} Error
          </p>
          <p className="font-sans text-xs text-[#8c90a1]">
            {this.state.error?.message || 'An error occurred. Other modules continue running.'}
          </p>
        </div>
        <button
          onClick={() => this.setState({ hasError: false })}
          className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#b3c5ff] hover:text-[#e1e2ee] border border-[#424656] px-3 py-1 rounded transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }
}
