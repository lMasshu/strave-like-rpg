export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaUnavailableError extends Error {
  constructor(message = 'Le service Ollama local est indisponible.') {
    super(message);
    this.name = 'OllamaUnavailableError';
  }
}

export interface IOllamaClient {
  chat(messages: OllamaChatMessage[]): Promise<string>;
  chatStream(
    messages: OllamaChatMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export class OllamaClient implements IOllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; model?: string; timeoutMs?: number }) {
    this.baseUrl =
      options?.baseUrl ||
      process.env.OLLAMA_URL ||
      'http://127.0.0.1:11434';
    this.model =
      options?.model ||
      process.env.OLLAMA_MODEL ||
      'mistral:7b';
    this.timeoutMs = options?.timeoutMs || 120_000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: OllamaChatMessage[]): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          keep_alive: '60m',
          options: {
            temperature: 0.2,
            repeat_penalty: 1.15,
            num_predict: 450,
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'TimeoutError';
      if (isAbort) {
        throw new OllamaUnavailableError(
          `Délai dépassé (${this.timeoutMs / 1000}s) lors de la réponse du modèle local ${this.model}.`,
        );
      }
      throw new OllamaUnavailableError(
        `Impossible de contacter Ollama sur ${this.baseUrl}. Vérifiez que le conteneur ou service local est démarré.`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new OllamaUnavailableError(
        `Erreur renvoyée par Ollama (${response.status}) : ${text || response.statusText}`,
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error('Réponse vide renvoyée par le modèle');
    }

    return content;
  }

  async chatStream(
    messages: OllamaChatMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          keep_alive: '60m',
          options: {
            temperature: 0.2,
            repeat_penalty: 1.15,
            num_predict: 1000,
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'TimeoutError';
      if (isAbort) {
        throw new OllamaUnavailableError(
          `Délai dépassé (${this.timeoutMs / 1000}s) lors du streaming du modèle local ${this.model}.`,
        );
      }
      throw new OllamaUnavailableError(
        `Impossible de contacter Ollama sur ${this.baseUrl}. Vérifiez que le conteneur ou service local est démarré.`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new OllamaUnavailableError(
        `Erreur renvoyée par Ollama (${response.status}) : ${text || response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error('Flux de réponse non disponible');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed) as {
              message?: { content?: string };
              done?: boolean;
            };
            if (data.message?.content) {
              onChunk(data.message.content);
              fullText += data.message.content;
            }
          } catch {
            // Ligne NDJSON partielle
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const result = fullText.trim();
    if (!result) {
      throw new Error('Réponse vide renvoyée par le modèle');
    }
    return result;
  }
}
