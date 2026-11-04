import { Component, type ReactNode } from 'react'
import { buttonClass } from '@renderer/ui'
import { messageOf } from '@shared/errors'

interface State {
  message: string | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: unknown): State {
    return { message: messageOf(error) }
  }

  render(): ReactNode {
    const { message } = this.state
    if (message === null) return this.props.children
    return (
      <div
        role="alert"
        className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center text-gray-900 dark:bg-gray-950 dark:text-gray-100"
      >
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="max-w-xl text-sm wrap-anywhere text-gray-500 dark:text-gray-400">{message}</p>
        <button
          type="button"
          className={buttonClass.primary}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    )
  }
}
