import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CliToken } from '../auth/cli-token.entity';
import { TokenValidatorService } from '../auth/token-validator.service';
import { MinioService } from '../minio/minio.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [TypeOrmModule.forFeature([CliToken])],
  controllers: [McpController],
  providers: [McpService, MinioService, TokenValidatorService],
})
export class McpModule {}
