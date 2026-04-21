import { Module } from '@nestjs/common';
import { NatsQueueService } from './nats-queue.service';
import { ServiceBusQueueService } from './service-bus-queue.service';
import { QueueService } from './queue.interface';

export const QUEUE_SERVICE = 'QUEUE_SERVICE';

@Module({
  providers: [
    {
      provide: QUEUE_SERVICE,
      useFactory: async (): Promise<QueueService> => {
        const driver = process.env.QUEUE_DRIVER || 'nats';
        if (driver === 'service-bus') {
          return new ServiceBusQueueService();
        }
        const svc = new NatsQueueService();
        await svc.connect();
        return svc;
      },
    },
  ],
  exports: [QUEUE_SERVICE],
})
export class QueueModule {}
