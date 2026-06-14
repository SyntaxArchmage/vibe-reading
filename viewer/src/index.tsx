import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import { App } from "./App";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: "#f44747", fontFamily: "monospace", background: "#1e1e1e", height: "100vh" }}>
          <h2>Vibe Reading Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#ccc" }}>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<ErrorBoundary><App /></ErrorBoundary>);
