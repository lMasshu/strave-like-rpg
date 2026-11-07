import type { IEventPublisher } from '../../core/ports/eventPublisher.js';

export class InMemoryEventPublisher implements IEventPublisher {
  public readonly events: Array<{ routingKey: string; payload: Record<string, unknown>; timestamp: Date }> = [];

  async publish<T extends Record<string, unknown>>(routingKey: string, payload: T): Promise<void> {
    this.events.push({
      routingKey,
      payload,
      timestamp: new Date(),
    });
  }
}
