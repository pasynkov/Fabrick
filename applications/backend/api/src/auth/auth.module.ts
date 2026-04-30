import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FabrickAuthGuard } from './fabrick-auth.guard';
import { IsAdminGuard } from './is-admin.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RefreshAuthGuard } from './refresh-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, OrgMember]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me-in-production',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, FabrickAuthGuard, RefreshAuthGuard, IsAdminGuard],
  exports: [JwtAuthGuard, FabrickAuthGuard, RefreshAuthGuard, IsAdminGuard, TypeOrmModule, JwtModule],
})
export class AuthModule {}
