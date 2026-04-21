export interface QueueService {
  publish(queue: string, payload: Record<string, unknown>): Promise<void>;
  subscribe(queue: string, handler: (payload: Record<string, unknown>) => Promise<void>): Promise<void>;
}
