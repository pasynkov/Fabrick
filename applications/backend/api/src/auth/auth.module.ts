import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CliToken } from '../entities/cli-token.entity';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { MinioModule } from '../minio/minio.module';
import { AnyAuthGuard } from './any-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CliTokenGuard } from './cli-token.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, OrgMember, CliToken]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me-in-production',
      signOptions: { expiresIn: '1h' },
    }),
    MinioModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, CliTokenGuard, AnyAuthGuard],
  exports: [JwtAuthGuard, CliTokenGuard, AnyAuthGuard, TypeOrmModule, JwtModule],
})
export class AuthModule {}
