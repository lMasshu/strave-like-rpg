import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  ApiClient,
  ApiError,
  apiClient as defaultApiClient,
  AuthSession,
  PlayerProfileDto,
  RegisterDto,
} from "../services/apiClient";
import { AuthContext, AuthContextValue, AuthStatus } from "./authContext";
import {
  clearSessionToken,
  readSessionToken,
  writeSessionToken,
} from "./sessionStorage";

function isAuth0Configured(): boolean {
  return Boolean(
    import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID,
  );
}

export interface AuthProviderProps {
  children: ReactNode;
  client?: ApiClient;
  /**
   * Appelé après une connexion ou une inscription réussie (pas lors de la
   * restauration d'une session au lancement), juste avant l'affichage de l'appli.
   */
  onSignIn?: () => void;
}

/**
 * Session Stride Quest : comptes e-mail + mot de passe gérés par l'API, et
 * « Continuer avec Google » via Auth0 (l'ID token est échangé contre une session API).
 */
function AuthProvider({
  children,
  client = defaultApiClient,
  onSignIn,
}: AuthProviderProps) {
  const { loginWithPopup, getIdTokenClaims, logout: auth0Logout } = useAuth0();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [player, setPlayer] = useState<PlayerProfileDto | null>(null);
  const googleAvailable = isAuth0Configured();

  const endSession = useCallback(() => {
    clearSessionToken();
    client.setAuthToken(undefined);
    setPlayer(null);
    setStatus("anonymous");
  }, [client]);

  const startSession = useCallback(
    (session: AuthSession) => {
      writeSessionToken(session.token);
      client.setAuthToken(session.token);
      onSignIn?.();
      setPlayer(session.player);
      setStatus("authenticated");
    },
    [client, onSignIn],
  );

  // Session expirée ou révoquée pendant l'utilisation : retour à l'écran de connexion.
  useEffect(() => {
    client.onUnauthorized(endSession);
    return () => client.onUnauthorized(undefined);
  }, [client, endSession]);

  // Restauration de la session au lancement de l'appli.
  useEffect(() => {
    const token = readSessionToken();
    if (!token) {
      setStatus("anonymous");
      return;
    }
    let cancelled = false;
    client.setAuthToken(token);
    client
      .getCurrentPlayer()
      .then((profile) => {
        if (cancelled) return;
        setPlayer(profile);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          endSession();
        } else {
          // Serveur injoignable : on garde la session, le profil se rechargera plus tard.
          setStatus("authenticated");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, endSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      startSession(await client.login(email, password));
    },
    [client, startSession],
  );

  const register = useCallback(
    async (data: RegisterDto) => {
      startSession(await client.register(data));
    },
    [client, startSession],
  );

  const loginWithGoogle = useCallback(async () => {
    if (!googleAvailable) {
      throw new ApiError(
        "La connexion Google n'est pas encore configurée.",
        503,
      );
    }
    await loginWithPopup({
      authorizationParams: { connection: "google-oauth2" },
    });
    const idToken = (await getIdTokenClaims())?.__raw;
    if (!idToken) throw new ApiError("Connexion Google annulée.", 401);
    startSession(await client.loginWithGoogle(idToken));
  }, [client, getIdTokenClaims, googleAvailable, loginWithPopup, startSession]);

  const logout = useCallback(() => {
    endSession();
    if (googleAvailable) {
      // Efface aussi le cache local Auth0, sans quitter l'appli.
      void Promise.resolve(auth0Logout({ openUrl: false })).catch(
        () => undefined,
      );
    }
  }, [auth0Logout, endSession, googleAvailable]);

  const refreshPlayer = useCallback(async () => {
    setPlayer(await client.getCurrentPlayer());
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      player,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshPlayer,
      googleAvailable,
    }),
    [
      status,
      player,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshPlayer,
      googleAvailable,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
