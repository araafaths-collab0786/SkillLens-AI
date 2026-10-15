/**
 * ErrorBoundary — catches render errors in the component tree.
 *
 * Provides a fallback UI that tells the user something went wrong
 * without leaking internal stack traces.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={<p>Custom error message</p>}>
 *     ...
 *   </ErrorBoundary>
 */
"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to error reporting service.
    // Do NOT log personal data. Log only the error type and component stack.
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error.message, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3"
        >
          <div className="flex justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
          </div>
          <p className="font-semibold text-deep-navy">Something went wrong</p>
          <p className="text-sm text-gray-500">
            An unexpected error occurred. Try refreshing the section.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-deep-navy hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text transition-colors duration-200"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
