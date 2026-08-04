import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("HydrApp error boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen-center" style={{ flexDirection: "column", gap: 12 }}>
          <p style={{ fontWeight: 600 }}>Algo salió mal.</p>
          <p>Intenta recargar la página. Si sigue pasando, cierra sesión y vuelve a entrar.</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
