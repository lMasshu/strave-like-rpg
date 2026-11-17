import { describe, expect, it } from "vitest";
import {
  computeTotals,
  distanceBars,
  formatActiveDuration,
  periodLabel,
  periodRange,
  StatsActivity,
} from "./activityStats";

// Dates construites en heure locale : les tests ne dépendent pas du fuseau de la machine.
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);

function run(start: Date, km: number, dPlus = 0, minutes = 30): StatsActivity {
  return {
    startedAt: start.toISOString(),
    distanceMeters: km * 1000,
    elevationGainMeters: dPlus,
    durationSeconds: minutes * 60,
  };
}

// Mardi 17 novembre 2026, 15 h.
const NOW = local(2026, 11, 17, 15);

describe("periodRange", () => {
  it("semaine du lundi 00:00 au lundi suivant", () => {
    expect(periodRange("week", NOW)).toEqual({
      from: local(2026, 11, 16),
      to: local(2026, 11, 23),
    });
  });

  it("le dimanche appartient encore à la semaine commencée le lundi", () => {
    expect(periodRange("week", local(2026, 11, 22, 23, 59)).from).toEqual(
      local(2026, 11, 16),
    );
  });

  it("semaine à cheval sur deux mois et deux années", () => {
    expect(periodRange("week", local(2027, 1, 1))).toEqual({
      from: local(2026, 12, 28),
      to: local(2027, 1, 4),
    });
  });

  it("mois et année calendaires", () => {
    expect(periodRange("month", NOW)).toEqual({
      from: local(2026, 11, 1),
      to: local(2026, 12, 1),
    });
    expect(periodRange("year", NOW)).toEqual({
      from: local(2026, 1, 1),
      to: local(2027, 1, 1),
    });
  });
});

describe("computeTotals", () => {
  const week = periodRange("week", NOW);

  it("additionne uniquement les activités de la période", () => {
    const totals = computeTotals(
      [
        run(local(2026, 11, 16, 7), 10.35, 40, 61),
        run(local(2026, 11, 17, 18), 5.2, 12, 30),
        run(local(2026, 11, 15, 23, 59), 8), // dimanche précédent
        run(local(2026, 11, 23), 3), // lundi suivant, borne exclue
      ],
      week,
    );

    expect(totals).toEqual({
      distanceKm: 15.6,
      elevationMeters: 52,
      activityCount: 2,
      durationSeconds: 91 * 60,
    });
  });

  it("renvoie des zéros sans activité et ignore une date invalide", () => {
    expect(
      computeTotals([{ ...run(NOW, 5), startedAt: "pas une date" }], week),
    ).toEqual({
      distanceKm: 0,
      elevationMeters: 0,
      activityCount: 0,
      durationSeconds: 0,
    });
  });
});

describe("distanceBars", () => {
  it("semaine : une barre par jour, lundi en premier, aujourd'hui en surbrillance", () => {
    const range = periodRange("week", NOW);
    const bars = distanceBars(
      "week",
      range,
      [
        run(local(2026, 11, 16, 7), 10.35),
        run(local(2026, 11, 16, 19), 2),
        run(local(2026, 11, 22, 10), 21.1),
      ],
      NOW,
    );

    expect(bars.map((b) => b.label)).toEqual([
      "Lun",
      "Mar",
      "Mer",
      "Jeu",
      "Ven",
      "Sam",
      "Dim",
    ]);
    expect(bars.map((b) => b.km)).toEqual([12.4, 0, 0, 0, 0, 0, 21.1]);
    expect(bars.filter((b) => b.isCurrent).map((b) => b.label)).toEqual([
      "Mar",
    ]);
  });

  it("mois : tranches de 7 jours, dernière tranche raccourcie", () => {
    const range = periodRange("month", NOW);
    const bars = distanceBars(
      "month",
      range,
      [run(local(2026, 11, 1), 5), run(local(2026, 11, 30, 20), 7)],
      NOW,
    );

    expect(bars.map((b) => b.label)).toEqual([
      "1–7",
      "8–14",
      "15–21",
      "22–28",
      "29–30",
    ]);
    expect(bars.map((b) => b.km)).toEqual([5, 0, 0, 0, 7]);
    expect(bars.find((b) => b.isCurrent)?.label).toBe("15–21");
  });

  it("février non bissextile : quatre tranches", () => {
    const now = local(2027, 2, 10);
    expect(
      distanceBars("month", periodRange("month", now), [], now).map(
        (b) => b.label,
      ),
    ).toEqual(["1–7", "8–14", "15–21", "22–28"]);
  });

  it("année : une barre par mois", () => {
    const range = periodRange("year", NOW);
    const bars = distanceBars(
      "year",
      range,
      [run(local(2026, 1, 3), 4), run(local(2026, 11, 16), 10)],
      NOW,
    );

    expect(bars).toHaveLength(12);
    expect(bars[0]).toEqual({ label: "Jan", km: 4, isCurrent: false });
    expect(bars[10]).toEqual({ label: "Nov", km: 10, isCurrent: true });
  });
});

describe("formatage", () => {
  it.each([
    [0, "0 min"],
    [45 * 60, "45 min"],
    [3660, "1 h 01"],
    [11100, "3 h 05"],
  ])("durée %i s → %s", (seconds, expected) => {
    expect(formatActiveDuration(seconds)).toBe(expected);
  });

  it("libellé de la période", () => {
    expect(periodLabel("week", periodRange("week", NOW))).toBe(
      "Du 16 au 22 novembre",
    );
    expect(periodLabel("week", periodRange("week", local(2026, 12, 1)))).toBe(
      "Du 30 novembre au 6 décembre",
    );
    expect(periodLabel("month", periodRange("month", NOW))).toBe(
      "novembre 2026",
    );
    expect(periodLabel("year", periodRange("year", NOW))).toBe("2026");
  });
});
