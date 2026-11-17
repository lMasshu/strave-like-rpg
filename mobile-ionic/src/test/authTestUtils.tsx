import { ReactNode } from "react";
import { vi } from "vitest";
import { AuthContext, AuthContextValue } from "../auth/authContext";
import type { PlayerProfileDto } from "../services/apiClient";

export const TEST_PLAYER: PlayerProfileDto = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "Lucas_Run",
  email: "lucas@stridequest.dev",
  level: 1,
  experience: 820,
  createdAt: "2026-01-01T00:00:00.000Z",
  hasPassword: true,
  googleLinked: false,
};

/** Valeur de contexte d'un joueur connecté, à surcharger selon le test. */
export function fakeAuth(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    status: "authenticated",
    player: TEST_PLAYER,
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    loginWithGoogle: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    refreshPlayer: vi.fn().mockResolvedValue(undefined),
    googleAvailable: false,
    ...overrides,
  };
}

export function withAuth(ui: ReactNode, value: AuthContextValue = fakeAuth()) {
  return <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>;
}
