import React from 'react';
import { Shield } from 'lucide-react';

export default class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      let displayMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse((this as any).state.error.message);
        if (parsedError.error) {
          displayMessage = `Database Error: ${parsedError.error}`;
        }
      } catch (e) {
        displayMessage = (this as any).state.error.message || displayMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
            <p className="text-gray-600 mb-6">{displayMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
