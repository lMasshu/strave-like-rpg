import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { apiClient, ApiError } from "./services/apiClient";
import { TEST_PLAYER } from "./test/authTestUtils";

const TOKEN_KEY = "stride_session_token";

describe("App (connexion obligatoire)", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/parametres");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.setAuthToken(undefined);
  });

  it("affiche la page de connexion sans session, sans barre d'onglets", async () => {
    const { container } = render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Se connecter" }),
    ).toBeInTheDocument();
    expect(container.querySelector("ion-tab-bar")).toBeNull();
  });

  it("restaure la session enregistrée et ouvre l'appli (Paramètres, onglets masqués)", async () => {
    localStorage.setItem(TOKEN_KEY, "jeton-valide");
    const getPlayer = vi
      .spyOn(apiClient, "getCurrentPlayer")
      .mockResolvedValue(TEST_PLAYER);

    const { container } = render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Paramètres" }),
    ).toBeInTheDocument();
    expect(container.querySelector("ion-tab-bar")).toHaveClass(
      "tab-bar-hidden",
    );
    expect(getPlayer).toHaveBeenCalled();
  });

  it("ouvre l'Accueil après la connexion, même depuis une autre page", async () => {
    vi.spyOn(apiClient, "login").mockResolvedValue({
      token: "jeton-neuf",
      player: TEST_PLAYER,
    });
    vi.spyOn(apiClient, "getCurrentPlayer").mockResolvedValue(TEST_PLAYER);
    const { container } = render(<App />);
    await screen.findByRole("heading", { name: "Se connecter" });

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@stridequest.dev" },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "stride-demo-2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => expect(window.location.pathname).toBe("/accueil"));
    await waitFor(() =>
      expect(container.querySelector("ion-tab-bar")).not.toHaveClass(
        "tab-bar-hidden",
      ),
    );
    expect(screen.queryByRole("heading", { name: "Paramètres" })).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jeton-neuf");
  });

  it("efface une session expirée et revient à la connexion", async () => {
    localStorage.setItem(TOKEN_KEY, "jeton-expire");
    vi.spyOn(apiClient, "getCurrentPlayer").mockRejectedValue(
      new ApiError("Authentification requise", 401),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Se connecter" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
