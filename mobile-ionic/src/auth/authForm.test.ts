import { describe, expect, it } from "vitest";
import { evaluatePassword, validateAuthForm } from "./authForm";

const valid = {
  username: "Lea_Trail",
  email: "lea@example.com",
  password: "Trail-running-42!",
  confirm: "Trail-running-42!",
};

describe("evaluatePassword", () => {
  it("attribue le score maximal pour un mot de passe conforme", () => {
    const result = evaluatePassword("AlexisPv!!!2");
    expect(result.isValid).toBe(true);
    expect(result.score).toBe(5);
    expect(result.label).toBe("Conforme");
    expect(result.colorClass).toBe("strong");
    expect(result.criteria.every((c) => c.met)).toBe(true);
  });

  it("détecte les critères manquants", () => {
    const withoutSpecial = evaluatePassword("AlexisPv1234");
    expect(withoutSpecial.isValid).toBe(false);
    expect(withoutSpecial.criteria.find((c) => c.id === "special")?.met).toBe(
      false,
    );

    const withoutUpper = evaluatePassword("alexispv!!!2");
    expect(withoutUpper.criteria.find((c) => c.id === "uppercase")?.met).toBe(
      false,
    );

    const tooShort = evaluatePassword("Alex!2");
    expect(tooShort.criteria.find((c) => c.id === "length")?.met).toBe(false);
  });
});

describe("validateAuthForm", () => {
  it("accepte une inscription et une connexion valides", () => {
    expect(validateAuthForm("register", valid)).toBeNull();
    expect(
      validateAuthForm("login", { ...valid, password: "x", confirm: "" }),
    ).toBeNull();
  });

  it.each([
    [{ username: "ab" }, /pseudo/i],
    [{ username: "pas d'espace" }, /pseudo/i],
    [{ email: "lea@" }, /e-mail valide/i],
    [{ password: "Court1!", confirm: "Court1!" }, /au moins 12/i],
    [{ password: "sansmajuscule12!", confirm: "sansmajuscule12!" }, /normes/i],
    [{ password: "SANSMINUSCULE12!", confirm: "SANSMINUSCULE12!" }, /normes/i],
    [{ password: "SansChiffres!!", confirm: "SansChiffres!!" }, /normes/i],
    [{ password: "SansSpecial1234", confirm: "SansSpecial1234" }, /normes/i],
    [{ password: "        ", confirm: "        " }, /vide/i],
    [{ confirm: "Autre-mot-de-passe-12!" }, /ne correspondent pas/i],
  ])("refuse à l'inscription : %o", (change, message) => {
    expect(validateAuthForm("register", { ...valid, ...change })).toMatch(
      message,
    );
  });

  it("à la connexion, n'exige ni pseudo ni critères de complexité", () => {
    expect(
      validateAuthForm("login", { ...valid, username: "", password: "court" }),
    ).toBeNull();
    expect(validateAuthForm("login", { ...valid, password: "" })).toMatch(
      /mot de passe/i,
    );
  });
});
