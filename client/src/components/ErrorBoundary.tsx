import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-950">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-surface-100">Something went wrong</h2>
            <p className="mb-4 text-sm text-surface-400">An unexpected error occurred. Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary-500/20 px-4 py-2 text-sm text-primary-400 transition-colors hover:bg-primary-500/30"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <pre className="mt-4 max-w-md overflow-auto rounded-lg bg-surface-900 p-4 text-left text-xs text-surface-400">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
