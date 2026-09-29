import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[AgriFusion ErrorBoundary] Uncaught component error:', error, errorInfo);
    }
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleHardReset = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || 'An unexpected user interface exception occurred.';

      return (
        <div className="min-h-screen bg-[#FDFBF7] text-stone-900 flex items-center justify-center p-4 font-sans">
          <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  Application Recovery
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  {this.props.fallbackTitle || 'AgriFusion Interface Recovery'}
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed">
                  An unexpected rendering error occurred in this view component. Your active session and farm parameters remain preserved.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs font-mono text-stone-700 break-words space-y-1">
              <span className="font-bold text-stone-500 uppercase text-[10px] block">Error Details</span>
              <p>{errMsg}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReload}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4 text-stone-600" />
                  <span>Reload Page</span>
                </button>
              </div>

              <button
                type="button"
                onClick={this.handleHardReset}
                className="px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-900 underline underline-offset-2 cursor-pointer"
              >
                Clear Cache & Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
