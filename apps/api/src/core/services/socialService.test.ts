import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CoordinatePair } from '../entities/activity.js';
import type { Player } from '../entities/player.js';
import { InMemoryActivityRepository } from '../../infrastructure/repositories/inMemory/inMemoryActivityRepo.js';
import { InMemoryPlayerRepository } from '../../infrastructure/repositories/inMemory/inMemoryPlayerRepo.js';
import { InMemorySocialRepository } from '../../infrastructure/repositories/inMemory/inMemorySocialRepo.js';
import { CannotFollowSelfError, PlayerNotFoundError, SocialService } from './socialService.js';

const PARIS: CoordinatePair = [2.3522, 48.8566];
const AMIENS: CoordinatePair = [2.2958, 49.8941];
const LYON: CoordinatePair = [4.8357, 45.764];

describe('SocialService', () => {
  let players: InMemoryPlayerRepository;
  let activities: InMemoryActivityRepository;
  let service: SocialService;
  let me: Player;

  const player = (username: string) =>
    players.create({ username, email: `${username}@test.dev`, passwordHash: 'x', auth0Sub: null });

  /** Sortie GPS commençant à `from` (le tracé fait quelques mètres). */
  const run = (who: Player, from: CoordinatePair | null, day: number) =>
    activities.create({
      id: randomUUID(),
      playerId: who.id,
      activityType: 'run',
      startedAt: new Date(Date.UTC(2026, 10, day, 8)),
      endedAt: new Date(Date.UTC(2026, 10, day, 9)),
      durationSeconds: 3600,
      distanceMeters: 10_000,
      elevationGainMeters: 0,
      coordinates: from ? [from, [from[0] + 0.001, from[1]]] : [],
      createdAt: new Date(),
    });

  beforeEach(async () => {
    players = new InMemoryPlayerRepository();
    activities = new InMemoryActivityRepository();
    service = new SocialService(new InMemorySocialRepository(players, activities), players);
    me = await player('moi');
  });

  describe('suivre', () => {
    it('ajoute aux amis, sans doublon, puis retire', async () => {
      const lea = await player('Lea');
      await service.follow(me.id, lea.id);
      await service.follow(me.id, lea.id);
      expect((await service.friends(me.id)).map((p) => p.username)).toEqual(['Lea']);

      await service.unfollow(me.id, lea.id);
      expect(await service.friends(me.id)).toEqual([]);
    });

    it('refuse de se suivre soi-même et un joueur inconnu', async () => {
      await expect(service.follow(me.id, me.id)).rejects.toBeInstanceOf(CannotFollowSelfError);
      await expect(service.follow(me.id, randomUUID())).rejects.toBeInstanceOf(
        PlayerNotFoundError,
      );
    });

    it("suivre n'est pas réciproque", async () => {
      const lea = await player('Lea');
      await service.follow(me.id, lea.id);
      expect(await service.friends(lea.id)).toEqual([]);
    });
  });

  describe('recherche', () => {
    it("liste tous les inscrits sauf moi, par pseudo, en signalant ceux que je suis", async () => {
      const hugo = await player('hugo');
      await player('Alice');
      await service.follow(me.id, hugo.id);

      const all = await service.search(me.id, '  ');
      expect(all.map((p) => [p.username, p.following])).toEqual([
        ['Alice', false],
        ['hugo', true],
      ]);
    });

    it('filtre par pseudo sans tenir compte de la casse', async () => {
      await player('Lucas_Run');
      await player('Lea_Trail');
      expect((await service.search(me.id, 'RUN')).map((p) => p.username)).toEqual(['Lucas_Run']);
      expect(await service.search(me.id, 'personne')).toEqual([]);
    });

    it('limite le nombre de résultats (20 par défaut, 50 au plus)', async () => {
      for (let i = 0; i < 55; i += 1) await player(`membre_${String(i).padStart(2, '0')}`);
      expect(await service.search(me.id, '')).toHaveLength(20);
      expect(await service.search(me.id, '', 5)).toHaveLength(5);
      expect(await service.search(me.id, '', 500)).toHaveLength(50);
      expect((await service.search(me.id, 'membre_0', 3)).map((p) => p.username)).toEqual([
        'membre_00',
        'membre_01',
        'membre_02',
      ]);
    });

    it("ne renvoie jamais l'e-mail des autres joueurs", async () => {
      await player('Lea');
      const [lea] = await service.search(me.id, 'Lea');
      expect(lea).not.toHaveProperty('email');
      expect(lea).not.toHaveProperty('passwordHash');
    });
  });

  describe("fil d'activités des amis", () => {
    it('uniquement mes amis, la plus récente en premier, sans tracé', async () => {
      const [lea, hugo, inconnu] = await Promise.all([
        player('Lea'),
        player('Hugo'),
        player('Inconnu'),
      ]);
      await service.follow(me.id, lea.id);
      await service.follow(me.id, hugo.id);
      await run(lea, PARIS, 10);
      await run(hugo, PARIS, 17);
      await run(lea, null, 14);
      await run(inconnu, null, 18); // pas suivi
      await run(me, null, 18); // mes propres sorties ne sont pas dans le fil

      const feed = await service.friendsFeed(me.id);
      expect(feed.map((a) => [a.player.username, a.startedAt.getUTCDate()])).toEqual([
        ['Hugo', 17],
        ['Lea', 14],
        ['Lea', 10],
      ]);
      expect(feed[0]).not.toHaveProperty('coordinates');
      expect(feed[0].player).not.toHaveProperty('email');
    });

    it('limite le nombre de sorties (20 par défaut, 50 au plus)', async () => {
      const lea = await player('Lea');
      await service.follow(me.id, lea.id);
      for (let day = 1; day <= 25; day += 1) await run(lea, null, day);

      expect(await service.friendsFeed(me.id)).toHaveLength(20);
      const three = await service.friendsFeed(me.id, 3);
      expect(three.map((a) => a.startedAt.getUTCDate())).toEqual([25, 24, 23]);
    });

    it('sans ami : fil vide', async () => {
      expect(await service.friendsFeed(me.id)).toEqual([]);
    });
  });

  describe('classement de la guilde', () => {
    const WEEK_FROM = new Date(Date.UTC(2026, 10, 16));
    const WEEK_TO = new Date(Date.UTC(2026, 10, 23));

    it('classe moi et mes amis par distance de la semaine, les autres exclus', async () => {
      const [lea, hugo, inconnu] = await Promise.all([
        player('Lea'),
        player('Hugo'),
        player('Inconnu'),
      ]);
      await service.follow(me.id, lea.id);
      await service.follow(me.id, hugo.id);
      await run(me, null, 17); // 10 km
      await run(lea, null, 16);
      await run(lea, null, 18); // 20 km
      await run(hugo, null, 9); // semaine précédente : ignorée
      await run(inconnu, null, 17); // pas suivi : absent

      const board = await service.leaderboard(me.id, WEEK_FROM, WEEK_TO);
      expect(
        board.map((e) => [e.player.username, e.distanceMeters, e.activityCount, e.rank, e.isMe]),
      ).toEqual([
        ['Lea', 20_000, 2, 1, false],
        ['moi', 10_000, 1, 2, true],
        ['Hugo', 0, 0, 3, false],
      ]);
    });

    it('à distance égale, même rang', async () => {
      const lea = await player('Lea');
      await service.follow(me.id, lea.id);
      await run(me, null, 17);
      await run(lea, null, 17);

      const board = await service.leaderboard(me.id, WEEK_FROM, WEEK_TO);
      expect(board.map((e) => [e.player.username, e.rank])).toEqual([
        ['Lea', 1],
        ['moi', 1],
      ]);
    });

    it('sans ami : je suis seul au classement', async () => {
      const board = await service.leaderboard(me.id, WEEK_FROM, WEEK_TO);
      expect(board).toEqual([
        expect.objectContaining({ distanceMeters: 0, rank: 1, isMe: true }),
      ]);
    });
  });

  describe('suggestions', () => {
    it('aucune suggestion sans sortie GPS', async () => {
      const lea = await player('Lea');
      await run(lea, PARIS, 1);
      await run(me, null, 2);
      expect(await service.suggestions(me.id)).toEqual([]);
    });

    it('propose les joueurs de ma zone principale, les plus actifs en premier', async () => {
      const [lea, hugo, loin] = await Promise.all([player('Lea'), player('Hugo'), player('Loin')]);
      await run(me, PARIS, 1);
      await run(lea, PARIS, 2);
      await run(hugo, PARIS, 3);
      await run(hugo, PARIS, 4);
      await run(loin, LYON, 5);

      const suggestions = await service.suggestions(me.id);
      expect(suggestions.map((s) => [s.player.username, s.activityCount, s.reason])).toEqual([
        ['Hugo', 2, 'main-zone'],
        ['Lea', 1, 'main-zone'],
      ]);
    });

    it('ajoute des joueurs de la ville de ma dernière sortie', async () => {
      const [parisien, amienois] = await Promise.all([player('Parisien'), player('Amienois')]);
      await run(me, PARIS, 1);
      await run(me, PARIS, 2);
      await run(me, AMIENS, 3); // dernière sortie, hors de la zone principale
      await run(parisien, PARIS, 4);
      await run(amienois, AMIENS, 5);

      const suggestions = await service.suggestions(me.id);
      expect(suggestions.map((s) => [s.player.username, s.reason])).toEqual([
        ['Parisien', 'main-zone'],
        ['Amienois', 'last-zone'],
      ]);
    });

    it('exclut les joueurs déjà suivis et se limite à 10', async () => {
      await run(me, PARIS, 1);
      const voisins = await Promise.all(
        Array.from({ length: 12 }, (_, i) => player(`voisin_${String(i).padStart(2, '0')}`)),
      );
      for (const voisin of voisins) await run(voisin, PARIS, 2);
      await service.follow(me.id, voisins[0].id);

      const suggestions = await service.suggestions(me.id);
      expect(suggestions).toHaveLength(10);
      expect(suggestions.map((s) => s.player.id)).not.toContain(voisins[0].id);
      expect(suggestions.map((s) => s.player.id)).not.toContain(me.id);
    });
  });
});
