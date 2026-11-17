import { describe, expect, it } from "vitest";
import { validateAuthForm } from "./authForm";

const valid = {
  username: "Lea_Trail",
  email: "lea@example.com",
  password: "trail-running-42",
  confirm: "trail-running-42",
};

describe("validateAuthForm", () => {
  it("accepte une inscription et une connexion valides", () => {
    expect(validateAuthForm("register", valid)).toBeNull();
    expect(
      validateAuthForm("login", { ...valid, password: "x", confirm: "" }),
    ).toBeNull();
  });

  it.each([
    [{ username: "ab" }, /pseudo/],
    [{ username: "pas d'espace" }, /pseudo/],
    [{ email: "lea@" }, /e-mail valide/],
    [{ password: "1234567", confirm: "1234567" }, /au moins 8/],
    [{ password: "        ", confirm: "        " }, /vide/],
    [{ confirm: "autre-mot-de-passe" }, /ne correspondent pas/],
  ])("refuse à l'inscription : %o", (change, message) => {
    expect(validateAuthForm("register", { ...valid, ...change })).toMatch(
      message,
    );
  });

  it("à la connexion, n'exige ni pseudo ni longueur minimale", () => {
    expect(
      validateAuthForm("login", { ...valid, username: "", password: "court" }),
    ).toBeNull();
    expect(validateAuthForm("login", { ...valid, password: "" })).toMatch(
      /mot de passe/,
    );
  });
});
