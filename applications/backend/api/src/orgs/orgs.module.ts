import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrgMember, User]),
    AuthModule,
  ],
  controllers: [OrgsController],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}
