/**
 * SpecificationErrorBoundary.tsx
 *
 * Class-based React error boundary for the Installation Specification feature.
 *
 * Catches runtime errors thrown during render or lifecycle of child components
 * and shows a recoverable card instead of blanking the whole app.
 *
 * Usage:
 *   <SpecificationErrorBoundary onBack={...}>
 *     <InstallationSpecificationPage ... />
 *   </SpecificationErrorBoundary>
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Called when the user clicks "Back to survey". */
  onBack: () => void;
}

interface State {
  hasError: boolean;
  retryKey: number;
}

export class SpecificationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryKey: 0 };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, retryKey: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SpecificationErrorBoundary] Installation Specification crashed:', error, info);
  }

  handleRetry = (): void => {
    this.setState(prev => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="specification-error-boundary"
          style={{
            padding: '2rem 1rem',
            maxWidth: 540,
            margin: '0 auto',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '1.5rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#1e3a5f',
                marginBottom: '0.5rem',
              }}
            >
              Installation Specification could not open.
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '1.5rem',
                lineHeight: 1.5,
              }}
            >
              The survey has not been lost. Return to the survey and continue, or
              try again after the next update.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                data-testid="specification-error-back-btn"
                onClick={this.props.onBack}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#1e3a5f',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Back to survey
              </button>
              <button
                type="button"
                data-testid="specification-error-retry-btn"
                onClick={this.handleRetry}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#f8fafc',
                  color: '#374151',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
