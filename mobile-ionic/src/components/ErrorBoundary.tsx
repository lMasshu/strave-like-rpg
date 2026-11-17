import React, { Component, ErrorInfo, ReactNode } from "react";
import { IonIcon } from "@ionic/react";
import { alertCircleOutline, refreshOutline } from "ionicons/icons";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            minHeight: "300px",
            color: "var(--sq-text-main, #f8fafc)",
          }}
        >
          <IonIcon
            icon={alertCircleOutline}
            style={{ fontSize: "48px", color: "var(--sq-gold-rpg, #d97706)" }}
          />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
            {this.props.fallbackTitle || "Un incident visuel est survenu"}
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--sq-text-muted, #94a3b8)",
              maxWidth: "400px",
              margin: 0,
            }}
          >
            L'affichage a rencontré un problème temporaire. Vous pouvez
            réinitialiser l'interface en un clic.
          </p>
          <button
            type="button"
            className="sq-profile-login-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
            onClick={this.handleReset}
          >
            <IonIcon icon={refreshOutline} />
            <span>Réessayer</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
