export interface IEventPublisher {
  publish<T extends Record<string, unknown>>(routingKey: string, payload: T): Promise<void>;
}
