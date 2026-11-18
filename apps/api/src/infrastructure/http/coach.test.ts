import { describe, expect, it } from 'vitest';
import { appWithPlayer, buildTestApp, registerPlayer } from '../../test/testApp.js';
import type { IOllamaClient, OllamaChatMessage } from '../../core/services/ollamaClient.js';
import { OllamaUnavailableError } from '../../core/services/ollamaClient.js';

class TestMockLlm implements IOllamaClient {
  public available = true;
  public response = 'Parole de sage de la Guilde.';

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async chat(_messages: OllamaChatMessage[]): Promise<string> {
    if (!this.available) {
      throw new OllamaUnavailableError('Service local inaccessible');
    }
    return this.response;
  }
}

describe('Routes HTTP Coach / Maître de Guilde', () => {
  it('exige une authentification sur toutes les routes coach', async () => {
    const app = await buildTestApp();

    const getSettings = await app.inject({ method: 'GET', url: '/api/coach/settings' });
    expect(getSettings.statusCode).toBe(401);

    const putSettings = await app.inject({ method: 'PUT', url: '/api/coach/settings' });
    expect(putSettings.statusCode).toBe(401);

    const getReport = await app.inject({ method: 'GET', url: '/api/coach/weekly-report' });
    expect(getReport.statusCode).toBe(401);

    const getMessages = await app.inject({ method: 'GET', url: '/api/coach/messages' });
    expect(getMessages.statusCode).toBe(401);

    const postMessage = await app.inject({
      method: 'POST',
      url: '/api/coach/messages',
      payload: { message: 'Hello' },
    });
    expect(postMessage.statusCode).toBe(401);
  });

  it('lit et met à jour les paramètres du coach', async () => {
    const { app, headers } = await appWithPlayer();

    // Paramètres par défaut
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/coach/settings',
      headers,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual({
      coachEnabled: false,
      coachGoal: 'casual',
    });

    // Mise à jour
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/coach/settings',
      headers,
      payload: {
        coachEnabled: true,
        coachGoal: 'marathon',
      },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json()).toEqual({
      coachEnabled: true,
      coachGoal: 'marathon',
    });

    // Rejet d'un objectif invalide
    const badRes = await app.inject({
      method: 'PUT',
      url: '/api/coach/settings',
      headers,
      payload: { coachGoal: 'triathlon-ultra' },
    });
    expect(badRes.statusCode).toBe(400);
  });

  it('génère et renvoie le bilan hebdomadaire', async () => {
    const mockLlm = new TestMockLlm();
    mockLlm.response = 'Bilan : bon travail sur le sentier !';
    const app = await buildTestApp({ llmClient: mockLlm });
    const { headers } = await registerPlayer(app);

    // Activé d'abord
    await app.inject({
      method: 'PUT',
      url: '/api/coach/settings',
      headers,
      payload: { coachEnabled: true, coachGoal: '10k' },
    });

    const reportRes = await app.inject({
      method: 'GET',
      url: '/api/coach/weekly-report',
      headers,
    });

    expect(reportRes.statusCode).toBe(200);
    const body = reportRes.json();
    expect(body.enabled).toBe(true);
    expect(body.report).not.toBeNull();
    expect(body.report.reportText).toBe('Bilan : bon travail sur le sentier !');
  });

  it('bascule sur le mode autonome résilient quand Ollama est indisponible', async () => {
    const mockLlm = new TestMockLlm();
    mockLlm.available = false;
    const app = await buildTestApp({ llmClient: mockLlm });
    const { headers } = await registerPlayer(app);

    await app.inject({
      method: 'PUT',
      url: '/api/coach/settings',
      headers,
      payload: { coachEnabled: true, coachGoal: '10k' },
    });

    const reportRes = await app.inject({
      method: 'GET',
      url: '/api/coach/weekly-report',
      headers,
    });
    expect(reportRes.statusCode).toBe(200);
    expect(reportRes.json().enabled).toBe(true);
    expect(reportRes.json().report.reportText).toContain('Conseil de Guilde');

    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/coach/messages',
      headers,
      payload: { message: 'Comment préparer un marathon ?' },
    });
    expect(chatRes.statusCode).toBe(201);
    expect(chatRes.json().message.content).toContain('endurance fondamentale');
  });

  it('permet de converser et de relire les messages', async () => {
    const mockLlm = new TestMockLlm();
    mockLlm.response = 'Repose tes mollets aujourd’hui, aventurier.';
    const app = await buildTestApp({ llmClient: mockLlm });
    const { headers } = await registerPlayer(app);

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/coach/messages',
      headers,
      payload: { message: 'J’ai une petite courbature après ma sortie hier.' },
    });
    expect(postRes.statusCode).toBe(201);
    expect(postRes.json().message.content).toBe('Repose tes mollets aujourd’hui, aventurier.');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/coach/messages',
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const msgs = listRes.json().messages;
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[1].role).toBe('user');
  });
});
