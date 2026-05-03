import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static override getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to Fastify server log via console.error so it appears in server output
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: 24,
            margin: 16,
            border: '1px solid #fca5a5',
            borderRadius: 8,
            background: '#fef2f2',
          }}
        >
          <h3 style={{ margin: '0 0 8px', color: '#b91c1c' }}>Something went wrong</h3>
          <p
            style={{
              margin: '0 0 16px',
              color: '#7f1d1d',
              fontSize: '0.9em',
              fontFamily: 'monospace',
            }}
          >
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '6px 16px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
