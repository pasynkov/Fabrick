import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ContextModule } from './context/context.module';
import { OrgMember } from './entities/org-member.entity';
import { Organization } from './entities/organization.entity';
import { Project } from './entities/project.entity';
import { Repository } from './entities/repository.entity';
import { User } from './entities/user.entity';
import { HealthController } from './health/health.controller';
import { migrations } from './migrations';
import { OrgsModule } from './orgs/orgs.module';
import { ReposModule } from './repos/repos.module';
import { SkillsModule } from './skills/skills.module';
import { SynthesisModule } from './synthesis/synthesis.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'fabrick',
        username: process.env.DB_USER || 'fabrick',
        password: process.env.DB_PASS || 'fabrick',
        entities: [User, Organization, OrgMember, Project, Repository],
        synchronize: false,
        migrationsRun: true,
        migrations,
        extra: { max: 2 },
      }),
    }),
    AuthModule,
    ContextModule,
    OrgsModule,
    ReposModule,
    SkillsModule,
    SynthesisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
