import { Injectable } from '@nestjs/common';
import { AggregateRoot } from '@nestjs/cqrs';
import { EventStoreService } from './event-store.service';
import { BaseDomainEvent } from './domain/base-domain-event';

@Injectable()
export class AggregateRepository {
  constructor(private readonly eventStore: EventStoreService) {}

  async persist(aggregate: AggregateRoot): Promise<void> {
    const events = aggregate.getUncommittedEvents() as BaseDomainEvent[];
    await this.eventStore.persistBatch(events.map((e) => e.toEntity()));
  }
}
