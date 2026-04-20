import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CliToken } from '../entities/cli-token.entity';
import { OrgMember } from '../entities/org-member.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { User } from '../entities/user.entity';
import { MinioModule } from '../minio/minio.module';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Repository, OrgMember, CliToken, User]),
    MinioModule,
    AuthModule,
  ],
  controllers: [ReposController],
  providers: [ReposService],
})
export class ReposModule {}
