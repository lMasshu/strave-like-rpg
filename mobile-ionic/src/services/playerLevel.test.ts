import { describe, expect, it } from "vitest";
import { levelProgress, XP_PER_LEVEL } from "./playerLevel";

describe("levelProgress", () => {
  it("nouveau compte : niveau 1, rien d'acquis", () => {
    expect(levelProgress(0)).toEqual({
      level: 1,
      xpInLevel: 0,
      xpToNextLevel: XP_PER_LEVEL,
      percent: 0,
    });
  });

  it("7 000 XP : niveau 8 tout juste atteint", () => {
    expect(levelProgress(7000)).toEqual({
      level: 8,
      xpInLevel: 0,
      xpToNextLevel: 1000,
      percent: 0,
    });
  });

  it("progression au sein du niveau", () => {
    expect(levelProgress(3450)).toEqual({
      level: 4,
      xpInLevel: 450,
      xpToNextLevel: 550,
      percent: 45,
    });
  });

  it("valeurs invalides ramenées à zéro", () => {
    expect(levelProgress(-50).level).toBe(1);
    expect(levelProgress(Number.NaN).xpInLevel).toBe(0);
  });
});
