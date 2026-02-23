import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (!root) return
  const pre = document.createElement('pre')
  pre.style.cssText = 'padding:16px;white-space:pre-wrap'
  pre.textContent = String(e.error || e.message)
  root.replaceChildren(pre)
})

window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root')
  if (!root) return
  const pre = document.createElement('pre')
  pre.style.cssText = 'padding:16px;white-space:pre-wrap'
  pre.textContent = String((e as PromiseRejectionEvent).reason)
  root.replaceChildren(pre)
})

interface ErrorBoundaryState { error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem 1rem',
          maxWidth: 600,
          margin: '0 auto',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <h2 style={{ color: '#c53030', marginBottom: '0.75rem' }}>Something went wrong</h2>
          <p style={{ color: '#4a5568', marginBottom: '1rem' }}>
            The app encountered an error. Please reload the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.25rem',
              background: '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <details style={{ marginTop: '1.5rem' }}>
            <summary style={{ color: '#718096', fontSize: '0.85rem', cursor: 'pointer' }}>
              Error details
            </summary>
            <pre style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: '#fff5f5',
              border: '1px solid #fed7d7',
              borderRadius: 6,
              fontSize: '0.75rem',
              color: '#c53030',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
