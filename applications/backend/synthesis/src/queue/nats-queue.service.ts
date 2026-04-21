import { Injectable, Logger } from '@nestjs/common';
import { connect, NatsConnection, StringCodec, JetStreamClient, JetStreamManager, consumerOpts } from 'nats';
import { QueueService } from './queue.interface';

@Injectable()
export class NatsQueueService implements QueueService {
  private readonly logger = new Logger(NatsQueueService.name);
  private readonly sc = StringCodec();
  private nc: NatsConnection;
  private js: JetStreamClient;
  private jsm: JetStreamManager;

  async connect(): Promise<void> {
    this.nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    this.js = this.nc.jetstream();
    this.jsm = await this.nc.jetstreamManager();
    this.logger.log(`Connected to NATS at ${process.env.NATS_URL || 'nats://localhost:4222'}`);
  }

  async publish(queue: string, payload: Record<string, unknown>): Promise<void> {
    await this.ensureStream(queue);
    await this.js.publish(queue, this.sc.encode(JSON.stringify(payload)));
  }

  async subscribe(queue: string, handler: (payload: Record<string, unknown>) => Promise<void>): Promise<void> {
    await this.ensureStream(queue);
    const opts = consumerOpts();
    opts.durable(`${queue}-worker`);
    opts.ackExplicit();
    opts.deliverAll();
    opts.deliverTo(`${queue}-deliver`);
    opts.ackWait(2 * 60 * 1000); // 2 min ack window; extended via msg.working() during processing
    const sub = await this.js.subscribe(queue, opts);
    (async () => {
      for await (const msg of sub) {
        const keepAlive = setInterval(() => msg.working(), 60 * 1000);
        try {
          const payload = JSON.parse(this.sc.decode(msg.data));
          await handler(payload);
          msg.ack();
        } catch (err: any) {
          this.logger.error(`Handler error on queue ${queue}: ${err?.message}`);
          msg.nak();
        } finally {
          clearInterval(keepAlive);
        }
      }
    })().catch((err) => this.logger.error(`Subscription loop error: ${err?.message}`));
  }

  private async ensureStream(name: string): Promise<void> {
    try {
      await this.jsm.streams.info(name);
    } catch {
      await this.jsm.streams.add({ name, subjects: [name] });
    }
  }
}
