import React from "react";

interface Props {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * SafeBoundary — aísla cada sección de la UI para que un crash en UN componente
 * no tumbe toda la pantalla. Si el componente interno tira, el boundary renderea
 * `fallback` (default: null, se oculta silenciosamente).
 *
 * Uso:
 *   <SafeBoundary name="PendienteHoy"><PendienteHoyCard .../></SafeBoundary>
 */
export class SafeBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log visible en console para diagnóstico
    console.error(`[SafeBoundary:${this.props.name}] captured error:`, error);
    console.error(`[SafeBoundary:${this.props.name}] componentStack:`, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
