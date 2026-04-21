import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrgMember } from '../entities/org-member.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { User } from '../entities/user.entity';
import { StorageModule } from '../storage/storage.module';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Repository, OrgMember, User]),
    StorageModule,
    AuthModule,
  ],
  controllers: [ReposController],
  providers: [ReposService],
})
export class ReposModule {}
