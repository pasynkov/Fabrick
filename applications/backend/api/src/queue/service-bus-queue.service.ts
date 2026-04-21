import { Injectable, Logger } from '@nestjs/common';
import { ServiceBusClient } from '@azure/service-bus';
import { QueueService } from './queue.interface';

@Injectable()
export class ServiceBusQueueService implements QueueService {
  private readonly client: ServiceBusClient;
  private readonly logger = new Logger(ServiceBusQueueService.name);

  constructor() {
    this.client = new ServiceBusClient(process.env.SERVICE_BUS_CONNECTION!);
  }

  async publish(queue: string, payload: Record<string, unknown>): Promise<void> {
    const sender = this.client.createSender(queue);
    try {
      await sender.sendMessages({ body: payload });
    } finally {
      await sender.close();
    }
  }

  async subscribe(queue: string, handler: (payload: Record<string, unknown>) => Promise<void>): Promise<void> {
    const receiver = this.client.createReceiver(queue);
    receiver.subscribe({
      async processMessage(message) {
        await handler(message.body as Record<string, unknown>);
      },
      async processError(args) {
        // errors surfaced by caller via handler rejection
      },
    });
  }
}
