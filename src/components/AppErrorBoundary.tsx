import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

/** Last resort so a render crash shows a recovery action instead of a white page. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-gray-700">This page hit a problem and could not finish loading.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-primary-dark px-5 py-2.5 text-sm font-semibold text-white"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
