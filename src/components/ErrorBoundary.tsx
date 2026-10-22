import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, LogIn, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[CloudPilot ErrorBoundary] Uncaught React rendering exception:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = '/';
  };

  handleGoLogin = () => {
    try {
      localStorage.removeItem('cloudpilot_authenticated');
      localStorage.removeItem('cloudpilot_jwt_token');
    } catch {}
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100vw',
          backgroundColor: '#F5F5F7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif',
          color: '#1D1D1F'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '36px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 20px 60px rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FF3B30'
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                  Workspace Recovery
                </h2>
                <p style={{ fontSize: '13px', color: '#636366', margin: '3px 0 0' }}>
                  CloudPilot recovered safely from an unexpected client error.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#FAFAFC',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              marginBottom: '24px',
              fontSize: '13px',
              lineHeight: 1.5,
              color: '#3A3A3C'
            }}>
              <strong>Error:</strong> {this.state.error?.message || 'An unknown render error occurred.'}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  flex: '1 1 140px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#0071E3',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <RefreshCw size={15} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  flex: '1 1 160px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#FFFFFF',
                  color: '#FF3B30',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 size={15} />
                <span>Clear Cache & Reset</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoLogin}
                style={{
                  flex: '1 1 140px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#FFFFFF',
                  color: '#1D1D1F',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <LogIn size={15} />
                <span>Sign In Again</span>
              </button>
            </div>

            {/* Diagnostic Details */}
            {this.state.errorInfo && (
              <div>
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0071E3',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{this.state.showDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}</span>
                </button>

                {this.state.showDetails && (
                  <pre style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#1E1E24',
                    color: '#E0E0E6',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: '180px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {this.state.error?.stack}
                    {'\n'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
