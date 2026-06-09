import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

/**
 * Re-exports all CQRS providers globally so child v2 modules
 * can inject CommandBus, EventBus, QueryBus, EventPublisher
 * without each importing CqrsModule directly.
 */
@Global()
@Module({
  imports: [CqrsModule],
  exports: [CqrsModule],
})
export class V2CqrsModule {}
