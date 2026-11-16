// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom/extend-expect";
import { vi } from "vitest";

// Mock matchmedia
window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

// Mock standard pour @auth0/auth0-react dans l'environnement de test Vitest
vi.mock("@auth0/auth0-react", () => {
  return {
    Auth0Provider: ({ children }: { children: React.ReactNode }) => children,
    useAuth0: () => ({
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      loginWithRedirect: vi.fn(),
      loginWithPopup: vi.fn(),
      logout: vi.fn(),
      getAccessTokenSilently: vi.fn().mockResolvedValue("mock-jwt-token-xyz"),
      getIdTokenClaims: vi.fn().mockResolvedValue({}),
      error: null,
    }),
  };
});
