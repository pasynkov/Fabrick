import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrgMember } from '../entities/org-member.entity';
import { Project } from '../entities/project.entity';
import { SearchRequest } from '../entities/search-request.entity';
import { TokenUsage } from '../entities/token-usage.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { SearchRequestRepository } from './search-request.repository';
import { TokenUsageRepository } from './token-usage.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, OrgMember, SearchRequest, TokenUsage]),
    AuthModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SearchRequestRepository, TokenUsageRepository],
  exports: [AnalyticsService, SearchRequestRepository, TokenUsageRepository],
})
export class AnalyticsModule {}
