import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryActivityRepository } from '../../infrastructure/repositories/inMemory/inMemoryActivityRepo.js';
import { InMemoryPlayerRepository } from '../../infrastructure/repositories/inMemory/inMemoryPlayerRepo.js';
import { InMemoryCoachRepository } from '../../infrastructure/repositories/inMemory/inMemoryCoachRepo.js';
import { CoachService, getIsoWeekAndYear, getWeekBounds } from './coachService.js';
import type { IOllamaClient, OllamaChatMessage } from './ollamaClient.js';
import type { Player } from '../entities/player.js';

class MockLlmClient implements IOllamaClient {
  public calls: OllamaChatMessage[][] = [];
  public nextResponse = 'Bravo aventurier, belle régularité cette semaine !';
  public shouldFail = false;

  async isAvailable(): Promise<boolean> {
    return !this.shouldFail;
  }

  async chat(messages: OllamaChatMessage[]): Promise<string> {
    if (this.shouldFail) {
      throw new Error('Ollama offline');
    }
    this.calls.push(messages);
    return this.nextResponse;
  }

  async chatStream(
    messages: OllamaChatMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    if (this.shouldFail) {
      throw new Error('Ollama offline');
    }
    this.calls.push(messages);
    const words = this.nextResponse.split(' ');
    for (const w of words) {
      onChunk(w + ' ');
    }
    return this.nextResponse;
  }
}

describe('CoachService', () => {
  let playerRepo: InMemoryPlayerRepository;
  let activityRepo: InMemoryActivityRepository;
  let coachRepo: InMemoryCoachRepository;
  let llmClient: MockLlmClient;
  let coachService: CoachService;
  let testPlayer: Player;

  beforeEach(async () => {
    playerRepo = new InMemoryPlayerRepository();
    activityRepo = new InMemoryActivityRepository();
    coachRepo = new InMemoryCoachRepository();
    llmClient = new MockLlmClient();
    coachService = new CoachService(
      coachRepo,
      playerRepo,
      activityRepo,
      llmClient,
    );

    testPlayer = await playerRepo.create({
      username: 'Arthur',
      email: 'arthur@camelot.bzh',
      passwordHash: 'hash',
      auth0Sub: null,
      coachEnabled: true,
      coachGoal: '10k',
    });
  });

  describe('Date & Week utilities', () => {
    it('calcule la semaine ISO et l’année correctement', () => {
      const refDate = new Date('2026-11-18T10:00:00Z');
      const { year, weekNumber } = getIsoWeekAndYear(refDate);
      expect(year).toBe(2026);
      expect(weekNumber).toBe(47);
    });

    it('calcule les bornes de la semaine du lundi au dimanche', () => {
      const { from, to } = getWeekBounds(2026, 47);
      expect(from.getUTCDay()).toBe(1); // Lundi
      expect(to.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getSettings / updateSettings', () => {
    it('renvoie les préférences du joueur', async () => {
      const settings = await coachService.getSettings(testPlayer.id);
      expect(settings).toEqual({
        coachEnabled: true,
        coachGoal: '10k',
      });
    });

    it('met à jour l’activation et l’objectif', async () => {
      const updated = await coachService.updateSettings(testPlayer.id, {
        coachEnabled: false,
        coachGoal: 'marathon',
      });

      expect(updated).toEqual({
        coachEnabled: false,
        coachGoal: 'marathon',
      });

      const fresh = await playerRepo.findById(testPlayer.id);
      expect(fresh?.coachEnabled).toBe(false);
      expect(fresh?.coachGoal).toBe('marathon');
    });
  });

  describe('getWeeklyReport', () => {
    it('ne génère aucun rapport si le coach est désactivé', async () => {
      await coachService.updateSettings(testPlayer.id, { coachEnabled: false });

      const result = await coachService.getWeeklyReport(testPlayer.id);
      expect(result.enabled).toBe(false);
      expect(result.report).toBeNull();
      expect(llmClient.calls.length).toBe(0);
    });

    it('génère un rapport via LLM et le met en cache', async () => {
      const now = new Date('2026-11-18T12:00:00Z');

      // Créer une activité cette semaine
      await activityRepo.create({
        id: 'act-1',
        playerId: testPlayer.id,
        activityType: 'run',
        startedAt: new Date('2026-11-17T09:00:00Z'),
        endedAt: new Date('2026-11-17T10:00:00Z'),
        durationSeconds: 3600,
        distanceMeters: 10000,
        elevationGainMeters: 120,
        coordinates: [],
        createdAt: new Date(),
      });

      llmClient.nextResponse = 'Bilan épique : 10 km franchis vaillamment !';

      const result = await coachService.getWeeklyReport(testPlayer.id, now);
      expect(result.enabled).toBe(true);
      expect(result.report).not.toBeNull();
      expect(result.report?.reportText).toBe('Bilan épique : 10 km franchis vaillamment !');
      expect(result.report?.summary.totalDistanceMeters).toBe(10000);
      expect(result.report?.summary.activityCount).toBe(1);
      expect(llmClient.calls.length).toBe(1);

      // Deuxième appel : doit provenir du cache sans réinterroger le LLM
      const cached = await coachService.getWeeklyReport(testPlayer.id, now);
      expect(cached.report?.id).toBe(result.report?.id);
      expect(llmClient.calls.length).toBe(1);
    });
  });

  describe('Chat interactif et rétention', () => {
    it('enregistre le message utilisateur et la réponse du coach', async () => {
      llmClient.nextResponse = 'Pour ton marathon, commence par consolider ta base d’endurance.';

      const reply = await coachService.handleChatMessage(
        testPlayer.id,
        'Comment préparer mon premier marathon dans 6 mois ?',
      );

      expect(reply.role).toBe('assistant');
      expect(reply.content).toContain('marathon');

      const messages = await coachService.getRecentMessages(testPlayer.id);
      expect(messages.length).toBe(2);
      expect(messages[0]!.role).toBe('assistant');
      expect(messages[1]!.role).toBe('user');
      expect(messages[1]!.content).toBe('Comment préparer mon premier marathon dans 6 mois ?');
    });

    it('stream la réponse du coach par morceaux et enregistre le message final', async () => {
      llmClient.nextResponse = 'Pour courir 10 km, régularité et patience.';
      const chunks: string[] = [];

      const reply = await coachService.handleChatMessageStream(
        testPlayer.id,
        'Conseil pour mon 10 km',
        (chunk) => chunks.push(chunk),
      );

      expect(reply.role).toBe('assistant');
      expect(reply.content).toBe('Pour courir 10 km, régularité et patience.');
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toContain('régularité');

      const messages = await coachService.getRecentMessages(testPlayer.id);
      expect(messages.length).toBe(2);
      expect(messages[0]!.content).toBe('Pour courir 10 km, régularité et patience.');
    });

    it('rejette les messages vides', async () => {
      await expect(coachService.handleChatMessage(testPlayer.id, '   ')).rejects.toThrow(
        'Le message ne peut pas être vide',
      );
    });

    it('purge automatiquement au-delà de 30 messages pour préserver le stockage', async () => {
      // Simuler 35 messages
      for (let i = 1; i <= 35; i++) {
        await coachRepo.saveMessage({
          playerId: testPlayer.id,
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const before = await coachRepo.getRecentMessages(testPlayer.id, 50);
      expect(before.length).toBe(35);

      await coachService.handleChatMessage(testPlayer.id, 'Nouveau message');

      const after = await coachRepo.getRecentMessages(testPlayer.id, 50);
      expect(after.length).toBe(30);
    });

    it('génère un prompt arithmétique pur pour une formule de calcul (ex: 4*4)', () => {
      const prompt = coachService.buildChatSystemPrompt(
        testPlayer,
        '4*4',
        10,
        2,
        new Date('2026-11-19T10:00:00Z'),
      );

      expect(prompt).toContain('calcul arithmétique');
      expect(prompt).toContain('Ignore totalement les conversations ou objectifs sportifs précédents');
    });

    it('génère un prompt ultra-court sans priming d’entraînement pour une question hors-sport (ex: Bonjour comment vas-tu ?)', () => {
      const prompt = coachService.buildChatSystemPrompt(
        testPlayer,
        'Bonjour comment vas-tu ?',
        10,
        2,
        new Date('2026-11-19T10:00:00Z'),
      );

      expect(prompt).toContain('mentor d\'aventure');
      expect(prompt).toContain('une seule phrase');
      expect(prompt).not.toContain('Semi-marathon');
      expect(prompt).not.toContain('Foncier');
    });

    it('génère un prompt orienté conseil sans structure de plan pour une question de douleur ou récupération', () => {
      const prompt = coachService.buildChatSystemPrompt(
        testPlayer,
        'J\'ai une douleur au mollet après ma séance',
        10,
        2,
        new Date('2026-11-19T10:00:00Z'),
      );

      expect(prompt).toContain('coach sportif protecteur');
      expect(prompt).toContain('Ne propose AUCUN programme');
      expect(prompt).not.toContain('Phase 1 - Foncier');
    });

    it('génère un prompt complet et cadré pour une demande explicite de programme d\'entraînement', () => {
      const prompt = coachService.buildChatSystemPrompt(
        testPlayer,
        'Donne-moi un programme pour préparer mon semi-marathon',
        10,
        2,
        new Date('2026-11-19T10:00:00Z'),
      );

      expect(prompt).toContain('Consignes impératives pour ce programme');
      expect(prompt).toContain('Vocabulaire athlétique rigoureux');
      expect(prompt).toContain('Tutoie SYSTÉMATIQUEMENT');
      expect(prompt).toContain('min/km');
    });
  });
});
