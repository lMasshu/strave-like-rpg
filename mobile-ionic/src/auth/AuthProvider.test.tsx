import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../services/apiClient";
import { TEST_PLAYER } from "../test/authTestUtils";
import AuthProvider from "./AuthProvider";
import { AuthContextValue, useAuth } from "./authContext";

const auth0 = vi.hoisted(() => ({
  loginWithPopup: vi.fn(),
  getIdTokenClaims: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@auth0/auth0-react", () => ({ useAuth0: () => auth0 }));

const TOKEN_KEY = "stride_session_token";
const SESSION = { token: "jwt-session", player: TEST_PLAYER };

function makeClient() {
  const client = new ApiClient("http://test-api");
  vi.spyOn(client, "login").mockResolvedValue(SESSION);
  vi.spyOn(client, "register").mockResolvedValue(SESSION);
  vi.spyOn(client, "loginWithGoogle").mockResolvedValue(SESSION);
  vi.spyOn(client, "getCurrentPlayer").mockResolvedValue(TEST_PLAYER);
  return client;
}

let current: AuthContextValue;
function Probe() {
  current = useAuth();
  return <p>statut : {current.status}</p>;
}

function renderProvider(client: ApiClient, onSignIn?: () => void) {
  render(
    <AuthProvider client={client} onSignIn={onSignIn}>
      <Probe />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(auth0).forEach((fn) => fn.mockReset());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("est anonyme sans jeton enregistré", async () => {
    const client = makeClient();
    renderProvider(client);

    expect(await screen.findByText("statut : anonymous")).toBeInTheDocument();
    expect(client.getCurrentPlayer).not.toHaveBeenCalled();
  });

  it("ouvre la session à la connexion, la mémorise puis la ferme à la déconnexion", async () => {
    const client = makeClient();
    const setToken = vi.spyOn(client, "setAuthToken");
    renderProvider(client);
    await screen.findByText("statut : anonymous");

    await act(() => current.login("lucas@stridequest.dev", "mot-de-passe"));

    expect(current.status).toBe("authenticated");
    expect(current.player).toEqual(TEST_PLAYER);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-session");
    expect(setToken).toHaveBeenLastCalledWith("jwt-session");

    act(() => current.logout());

    expect(current.status).toBe("anonymous");
    expect(current.player).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(setToken).toHaveBeenLastCalledWith(undefined);
  });

  it("prévient l'appli après une connexion ou une inscription, pas à la restauration", async () => {
    localStorage.setItem(TOKEN_KEY, "jeton");
    const onSignIn = vi.fn();
    const client = makeClient();
    renderProvider(client, onSignIn);
    await screen.findByText("statut : authenticated");
    expect(onSignIn).not.toHaveBeenCalled();

    await act(() => current.login("lucas@stridequest.dev", "mot-de-passe"));
    await act(() =>
      current.register({
        email: "lea@example.com",
        password: "mot-de-passe",
        username: "Lea",
      }),
    );

    expect(onSignIn).toHaveBeenCalledTimes(2);
  });

  it("revient à la connexion quand l'API signale une session expirée", async () => {
    localStorage.setItem(TOKEN_KEY, "jeton");
    const client = makeClient();
    renderProvider(client);
    await screen.findByText("statut : authenticated");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentification requise" }), {
        status: 401,
      }),
    );
    await act(async () => {
      await client.getPlayerActivities().catch(() => undefined);
    });

    expect(current.status).toBe("anonymous");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("garde la session si le serveur est injoignable au lancement", async () => {
    localStorage.setItem(TOKEN_KEY, "jeton");
    const client = makeClient();
    vi.mocked(client.getCurrentPlayer).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    renderProvider(client);

    expect(
      await screen.findByText("statut : authenticated"),
    ).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jeton");
  });

  it("refuse Google tant qu'Auth0 n'est pas configuré", async () => {
    vi.stubEnv("VITE_AUTH0_DOMAIN", "");
    const client = makeClient();
    renderProvider(client);
    await screen.findByText("statut : anonymous");

    await expect(current.loginWithGoogle()).rejects.toMatchObject({
      status: 503,
    });
    expect(auth0.loginWithPopup).not.toHaveBeenCalled();
  });

  it("échange l'ID token Google contre une session Stride Quest", async () => {
    vi.stubEnv("VITE_AUTH0_DOMAIN", "tenant.eu.auth0.com");
    vi.stubEnv("VITE_AUTH0_CLIENT_ID", "client-id");
    auth0.loginWithPopup.mockResolvedValue(undefined);
    auth0.getIdTokenClaims.mockResolvedValue({ __raw: "id-token-google" });
    const client = makeClient();
    renderProvider(client);
    await screen.findByText("statut : anonymous");

    await act(() => current.loginWithGoogle());

    expect(auth0.loginWithPopup).toHaveBeenCalledWith({
      authorizationParams: { connection: "google-oauth2" },
    });
    expect(client.loginWithGoogle).toHaveBeenCalledWith("id-token-google");
    await waitFor(() => expect(current.status).toBe("authenticated"));

    act(() => current.logout());
    expect(auth0.logout).toHaveBeenCalledWith({ openUrl: false });
  });

  it("signale une connexion Google sans ID token", async () => {
    vi.stubEnv("VITE_AUTH0_DOMAIN", "tenant.eu.auth0.com");
    vi.stubEnv("VITE_AUTH0_CLIENT_ID", "client-id");
    auth0.getIdTokenClaims.mockResolvedValue(undefined);
    const client = makeClient();
    renderProvider(client);
    await screen.findByText("statut : anonymous");

    await expect(current.loginWithGoogle()).rejects.toBeInstanceOf(ApiError);
    expect(client.loginWithGoogle).not.toHaveBeenCalled();
  });
});
