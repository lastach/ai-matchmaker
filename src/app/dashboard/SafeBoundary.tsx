'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * Per-section error boundary. If a child component throws during render,
 * we just render nothing instead of taking down the whole dashboard.
 * Useful around optional cards that depend on tables that may not exist
 * in this environment.
 */
export class SafeBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err: any, info: any) {
    console.warn('SafeBoundary caught', err, info)
  }
  render() { return this.state.hasError ? null : this.props.children }
}
