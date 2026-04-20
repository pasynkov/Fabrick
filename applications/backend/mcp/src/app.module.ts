import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CliToken } from './auth/cli-token.entity';
import { McpModule } from './mcp/mcp.module';

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
        entities: [CliToken],
        synchronize: false,
      }),
    }),
    McpModule,
  ],
})
export class AppModule {}
