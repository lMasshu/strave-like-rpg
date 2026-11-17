const TOKEN_KEY = "stride_session_token";

/**
 * Persistance du jeton de session. Le WebView Capacitor conserve le localStorage
 * entre deux lancements ; toutes les opérations tolèrent un stockage indisponible.
 */
export function readSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeSessionToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Stockage bloqué : la session ne durera que le temps de l'ouverture de l'appli.
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Rien à effacer.
  }
}
