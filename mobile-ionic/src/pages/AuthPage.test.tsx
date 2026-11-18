import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";
import { ApiError } from "../services/apiClient";
import { fakeAuth, withAuth } from "../test/authTestUtils";

function renderPage(auth = fakeAuth({ status: "anonymous", player: null })) {
  render(withAuth(<AuthPage />, auth));
  return auth;
}

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("AuthPage", () => {
  it("propose par défaut la connexion par e-mail, Google en simple logo", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Se connecter" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.queryByLabelText("Pseudo")).toBeNull();
    const google = screen.getByRole("button", {
      name: "Continuer avec Google",
    });
    expect(google).not.toHaveTextContent(/\w/);
  });

  it("connecte avec l'e-mail nettoyé et le mot de passe", async () => {
    const auth = renderPage();
    fill("E-mail", "  lucas@stridequest.dev ");
    fill("Mot de passe", "stride-demo-2026");

    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() =>
      expect(auth.login).toHaveBeenCalledWith(
        "lucas@stridequest.dev",
        "stride-demo-2026",
      ),
    );
  });

  it("affiche l'erreur renvoyée par le serveur", async () => {
    const auth = renderPage(
      fakeAuth({
        status: "anonymous",
        player: null,
        login: vi
          .fn()
          .mockRejectedValue(
            new ApiError("E-mail ou mot de passe incorrect", 401),
          ),
      }),
    );
    fill("E-mail", "lucas@stridequest.dev");
    fill("Mot de passe", "faux");

    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou mot de passe incorrect",
    );
    expect(auth.login).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Se connecter" }),
    ).not.toBeDisabled();
  });

  it("signale un serveur injoignable", async () => {
    renderPage(
      fakeAuth({
        status: "anonymous",
        player: null,
        login: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      }),
    );
    fill("E-mail", "lucas@stridequest.dev");
    fill("Mot de passe", "x");

    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Impossible de joindre le serveur/,
    );
  });

  it("inscrit un compte après validation des champs", async () => {
    const auth = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Inscription" }));
    expect(
      screen.getByRole("heading", { name: "Créer un compte" }),
    ).toBeInTheDocument();

    fill("Pseudo", "Lea_Trail");
    fill("E-mail", "lea@example.com");
    fill("Mot de passe", "court");
    fill("Confirmer le mot de passe", "court");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/au moins 12/);

    fill("Mot de passe", "Trail-running-42!");
    fill("Confirmer le mot de passe", "Trail-running-43!");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/ne correspondent pas/);
    expect(auth.register).not.toHaveBeenCalled();

    fill("Confirmer le mot de passe", "Trail-running-42!");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() =>
      expect(auth.register).toHaveBeenCalledWith({
        username: "Lea_Trail",
        email: "lea@example.com",
        password: "Trail-running-42!",
      }),
    );
  });

  it("affiche la jauge et la checklist dynamique de mot de passe en mode inscription", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Inscription" }));

    expect(
      screen.getByText(/au moins 12 caractères avec majuscule/i),
    ).toBeInTheDocument();

    fill("Mot de passe", "AlexisPv!!!2");

    expect(
      screen.getByText("Norme de sécurité (CNIL / ANSSI)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Conforme")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "5",
    );
  });

  it("affiche ou masque le mot de passe", () => {
    renderPage();
    const input = screen.getByLabelText("Mot de passe");

    fireEvent.click(
      screen.getByRole("button", { name: "Afficher le mot de passe" }),
    );
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(
      screen.getByRole("button", { name: "Masquer le mot de passe" }),
    );
    expect(input).toHaveAttribute("type", "password");
  });

  it("lance la connexion Google depuis le logo et affiche son erreur", async () => {
    const auth = renderPage(
      fakeAuth({
        status: "anonymous",
        player: null,
        loginWithGoogle: vi
          .fn()
          .mockRejectedValue(
            new ApiError(
              "La connexion Google n'est pas encore configurée.",
              503,
            ),
          ),
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continuer avec Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /pas encore configurée/,
    );
    expect(auth.loginWithGoogle).toHaveBeenCalledOnce();
  });
});
