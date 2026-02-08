import React from 'react';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error?: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    try {
      console.error('Uncaught error in component tree:', error, info);
    } catch (e) {
      // swallow
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex items-center justify-center p-4 bg-gray-50 text-gray-800">
          <div className="max-w-xl text-center">
            <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
            <p className="mb-4 text-sm">An unexpected error occurred while rendering the app. You can try reloading the page or contact support if the problem persists.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >Reload</button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent('App error report');
                  const body = encodeURIComponent(`Error: ${this.state.error?.message || 'unknown'}\n\nPlease describe what you were doing:`);
                  window.location.href = `mailto:support@pharmacy.example?subject=${subject}&body=${body}`;
                }}
                className="px-4 py-2 border rounded"
              >Report</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
