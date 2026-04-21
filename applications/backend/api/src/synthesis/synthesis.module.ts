import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { SynthesisController } from './synthesis.controller';
import { SynthesisService } from './synthesis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Organization, OrgMember, Repository]),
    StorageModule,
    QueueModule,
    AuthModule,
  ],
  controllers: [SynthesisController],
  providers: [SynthesisService],
})
export class SynthesisModule {}
