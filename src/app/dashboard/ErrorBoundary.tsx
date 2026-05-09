'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: any }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    console.error('Dashboard render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error || 'Unknown error')
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#2E1A47] via-[#3D2557] to-[#D4537E]/10 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg">
            <h2 className="text-xl font-bold text-[#3D1820] mb-2">Something went wrong rendering this page</h2>
            <p className="text-sm text-gray-700 mb-4">Your data is safe. The page hit an error trying to display - usually a missing field. You can try reloading or starting fresh.</p>
            <details className="mb-4 text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">Technical details</summary>
              <pre className="mt-2 p-2 bg-gray-50 rounded border whitespace-pre-wrap break-all">{msg}</pre>
            </details>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="bg-[#C8102E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#A50D26]"
              >
                Reload
              </button>
              <button
                onClick={() => { window.location.href = '/' }}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50"
              >
                Back home
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
