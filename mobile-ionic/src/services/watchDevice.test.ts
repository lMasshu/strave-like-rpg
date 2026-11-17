import { describe, expect, it } from "vitest";
import { watchDeviceLabel } from "./watchDevice";

describe("watchDeviceLabel", () => {
  it.each([
    ["Garmin Forerunner 255", "Garmin Forerunner 255"],
    ["  Polar Vantage V3 ", "Polar Vantage V3"],
    ["com.garmin.android.apps.connectmobile", "Garmin"],
    ["com.sec.android.app.shealth", "Samsung Galaxy Watch"],
    ["COM.FITBIT.FitbitMobile", "Fitbit"],
    ["fi.polar.polarflow", "Polar"],
  ])("%s → %s", (source, expected) => {
    expect(watchDeviceLabel(source)).toBe(expected);
  });

  it.each([null, undefined, "", "   ", "com.inconnu.appli"])(
    "renvoie undefined quand la montre est inconnue (%s)",
    (source) => {
      expect(watchDeviceLabel(source)).toBeUndefined();
    },
  );

  it("tronque un nom trop long pour l'API (100 caractères)", () => {
    expect(watchDeviceLabel("Montre ".repeat(30))).toHaveLength(100);
  });
});
