import { createContext, useContext } from "react";
import { ApiError, PlayerProfileDto, RegisterDto } from "../services/apiClient";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  player: PlayerProfileDto | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  /** Recharge le profil (XP, niveau) après une activité. */
  refreshPlayer: () => Promise<void>;
  /** La connexion Google est configurée (identifiants Auth0 présents). */
  googleAvailable: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return value;
}

/** Message affichable à partir d'une erreur réseau ou API. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion.";
  }
  if (error instanceof Error && /popup|closed|cancel/i.test(error.message)) {
    return "Connexion Google annulée.";
  }
  return "Une erreur inattendue est survenue. Réessayez.";
}
