import { describe, expect, it } from 'vitest';
import type { NearbyPlayer } from '../ports/socialRepository.js';
import { distanceMeters, homeZones, LAST_ZONE_SLOTS, rankSuggestions } from './homeZone.js';

const PARIS = { longitude: 2.3522, latitude: 48.8566 };
const PARIS_NORD = { longitude: 2.36, latitude: 48.88 }; // ~3 km
const AMIENS = { longitude: 2.2958, latitude: 49.8941 };
const LYON = { longitude: 4.8357, latitude: 45.764 };

const start = (point: { longitude: number; latitude: number }, day: number) => ({
  ...point,
  startedAt: new Date(Date.UTC(2026, 10, day, 8)),
});

const nearby = (id: string, activityCount = 1): NearbyPlayer => ({
  player: { id, username: id, level: 1, experience: 0, createdAt: new Date(0) },
  activityCount,
});

describe('distanceMeters', () => {
  it('Paris – Amiens ≈ 115 km', () => {
    expect(distanceMeters(PARIS, AMIENS)).toBeGreaterThan(110_000);
    expect(distanceMeters(PARIS, AMIENS)).toBeLessThan(120_000);
  });

  it('distance nulle sur le même point', () => {
    expect(distanceMeters(PARIS, PARIS)).toBe(0);
  });
});

describe('homeZones', () => {
  it('sans sortie GPS : aucune zone', () => {
    expect(homeZones([])).toBeNull();
  });

  it('ignore les coordonnées invalides', () => {
    expect(
      homeZones([
        { longitude: Number.NaN, latitude: 48, startedAt: new Date() },
        { longitude: 2, latitude: 120, startedAt: new Date() },
      ]),
    ).toBeNull();
  });

  it('zone principale = là où la majorité des sorties ont commencé', () => {
    const zones = homeZones([
      start(PARIS, 1),
      start(PARIS_NORD, 2),
      start(PARIS, 3),
      start(AMIENS, 10), // dernière sortie
    ]);
    expect(zones?.main).toMatchObject({ activityCount: 3 });
    expect(distanceMeters(zones!.main, PARIS)).toBeLessThan(10_000);
    expect(zones?.last).toMatchObject({ ...AMIENS, activityCount: 1 });
  });

  it('pas de zone « dernière sortie » quand elle est dans la zone principale', () => {
    const zones = homeZones([start(PARIS, 1), start(PARIS_NORD, 5)]);
    expect(zones?.main.activityCount).toBe(2);
    expect(zones?.last).toBeNull();
  });

  it('à égalité, la zone la plus récente devient la principale', () => {
    const zones = homeZones([start(LYON, 1), start(AMIENS, 2)]);
    expect(zones?.main).toMatchObject(AMIENS);
    expect(zones?.last).toBeNull();
  });
});

describe('rankSuggestions', () => {
  const main = Array.from({ length: 12 }, (_, i) => nearby(`main-${i}`, 12 - i));

  it('zone principale seule : les 10 plus actifs', () => {
    const ranked = rankSuggestions(main, [], 10);
    expect(ranked).toHaveLength(10);
    expect(ranked.every((s) => s.reason === 'main-zone')).toBe(true);
    expect(ranked[0].player.id).toBe('main-0');
  });

  it('réserve quelques places à la zone de la dernière sortie', () => {
    const last = Array.from({ length: 5 }, (_, i) => nearby(`last-${i}`));
    const ranked = rankSuggestions(main, last, 10);
    expect(ranked).toHaveLength(10);
    expect(ranked.filter((s) => s.reason === 'last-zone')).toHaveLength(LAST_ZONE_SLOTS);
    expect(ranked.slice(0, 7).every((s) => s.reason === 'main-zone')).toBe(true);
  });

  it('rend les places libres à la zone de la dernière sortie', () => {
    const last = Array.from({ length: 6 }, (_, i) => nearby(`last-${i}`));
    const ranked = rankSuggestions([nearby('a'), nearby('b')], last, 10);
    expect(ranked.map((s) => s.player.id)).toEqual([
      'a',
      'b',
      'last-0',
      'last-1',
      'last-2',
      'last-3',
      'last-4',
      'last-5',
    ]);
  });

  it('ne propose pas deux fois le même joueur', () => {
    const ranked = rankSuggestions([nearby('a'), nearby('b')], [nearby('a'), nearby('c')], 10);
    expect(ranked.map((s) => `${s.player.id}:${s.reason}`)).toEqual([
      'a:main-zone',
      'b:main-zone',
      'c:last-zone',
    ]);
  });
});
