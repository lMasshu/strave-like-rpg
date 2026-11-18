import { describe, expect, it } from "vitest";
import {
  formatDistanceKm,
  formatDuration,
  formatPaceOrSpeed,
  formatStartedAt,
  sportLabel,
} from "./friendActivityFormat";

// Dates construites en heure locale : les tests ne dépendent pas du fuseau de la machine.
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);
// Mercredi 18 novembre 2026, 15:00
const NOW = local(2026, 11, 18, 15);

describe("formatStartedAt", () => {
  it("aujourd'hui et hier avec l'heure", () => {
    expect(formatStartedAt(local(2026, 11, 18, 9, 5).toISOString(), NOW)).toBe(
      "Aujourd'hui · 09:05",
    );
    expect(
      formatStartedAt(local(2026, 11, 17, 23, 59).toISOString(), NOW),
    ).toBe("Hier · 23:59");
  });

  it("jour, date et heure au-delà", () => {
    expect(formatStartedAt(local(2026, 11, 16, 7, 30).toISOString(), NOW)).toBe(
      "lun. 16 nov. · 07:30",
    );
  });

  it("ajoute l'année si elle n'est pas l'année en cours", () => {
    expect(formatStartedAt(local(2025, 12, 31, 18).toISOString(), NOW)).toMatch(
      /^31 déc\. 2025 · 18:00$/,
    );
  });

  it("date invalide", () => {
    expect(formatStartedAt("pas une date", NOW)).toBe("Date inconnue");
  });
});

describe("formatPaceOrSpeed", () => {
  it("allure pour la course, la marche et la randonnée", () => {
    expect(formatPaceOrSpeed("run", 10_000, 3600)).toBe(`6'00"/km`);
    expect(formatPaceOrSpeed("walk", 5000, 3000)).toBe(`10'00"/km`);
    expect(formatPaceOrSpeed("hike", 3000, 1000)).toBe(`5'33"/km`);
  });

  it("vitesse pour le vélo", () => {
    expect(formatPaceOrSpeed("bike", 60_000, 10_800)).toBe("20.0 km/h");
  });

  it("tiret sans distance ou sans durée", () => {
    expect(formatPaceOrSpeed("run", 0, 600)).toBe("–");
    expect(formatPaceOrSpeed("bike", 1000, 0)).toBe("–");
  });
});

describe("libellés", () => {
  it("sport, distance et durée", () => {
    expect(sportLabel("run")).toBe("Course à pied");
    expect(sportLabel("bike")).toBe("Vélo");
    expect(sportLabel("ski")).toBe("Sortie");
    expect(formatDistanceKm(10_350)).toBe("10.3 km");
    expect(formatDistanceKm(-5)).toBe("0.0 km");
    expect(formatDuration(3600)).toBe("1 h 00");
  });
});
