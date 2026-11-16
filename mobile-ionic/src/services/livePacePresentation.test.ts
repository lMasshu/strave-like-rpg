import { describe, expect, it } from "vitest";
import { getLivePaceCaption } from "./livePacePresentation";

describe("getLivePaceCaption", () => {
  it.each([
    ["moving", "min/km • à cet instant"],
    ["stopped", "À l'arrêt"],
    ["unavailable", "Signal GPS indisponible"],
    ["paused", "En pause"],
    ["inactive", "min/km"],
  ] as const)("explains the %s pace state", (state, caption) => {
    expect(getLivePaceCaption(state)).toBe(caption);
  });
});
