import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { IonReactRouter } from "@ionic/react-router";
import Settings from "./Settings";
import { fakeAuth, withAuth } from "../test/authTestUtils";

const auth = fakeAuth();

describe("Settings page", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-palette");
    document.body.removeAttribute("data-palette");
  });

  it("presents the three interface palettes as an accessible radio group", () => {
    render(<IonReactRouter>{withAuth(<Settings />, auth)}</IonReactRouter>);

    expect(
      screen.getByRole("heading", { name: "Paramètres" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Thème de l’interface" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Palette de couleurs" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Lime Frost/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("radio", { name: /Violet Bloom/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Scarlet Snow/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Retour")).toBeInTheDocument();
  });

  it("applies the selected palette immediately", () => {
    render(<IonReactRouter>{withAuth(<Settings />, auth)}</IonReactRouter>);

    fireEvent.click(screen.getByRole("radio", { name: /Violet Bloom/i }));

    expect(
      screen.getByRole("radio", { name: /Violet Bloom/i }),
    ).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("stride_color_palette")).toBe("violet-bloom");
    expect(document.documentElement).toHaveAttribute(
      "data-palette",
      "violet-bloom",
    );
  });

  it("présente le compte connecté et le déconnecte au clic", () => {
    const session = fakeAuth({
      player: {
        ...auth.player!,
        googleLinked: true,
      },
    });
    render(<IonReactRouter>{withAuth(<Settings />, session)}</IonReactRouter>);

    const account = screen.getByRole("region", { name: "Profil" });
    expect(account).toHaveTextContent("Lucas_Run");
    expect(account).toHaveTextContent("lucas@stridequest.dev");
    const methods = screen.getByRole("list", { name: "Moyens de connexion" });
    expect(methods).toHaveTextContent("E-mail et mot de passe");
    expect(methods).toHaveTextContent("Google");
    expect(account).toHaveTextContent("TODO: gestion photo de profil");

    fireEvent.click(screen.getByRole("button", { name: /Se déconnecter/ }));

    expect(session.logout).toHaveBeenCalledOnce();
  });
});
