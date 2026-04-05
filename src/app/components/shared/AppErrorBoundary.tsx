import React from "react";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("App runtime error:", error);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.assign("/login");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center px-6"
          style={{
            backgroundImage: "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)",
          }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-10 pb-10 text-center">
            <h1 className="text-3xl font-black text-[#074738]">Pessy</h1>
            <p className="text-slate-500 mt-3 text-sm">Ocurrió un error inesperado en la aplicación.</p>
            <div className="mt-8 space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full py-4 rounded-2xl bg-[#074738] text-white font-bold"
              >
                Reintentar
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-4 rounded-2xl border-2 border-[#074738] text-[#074738] font-bold"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
