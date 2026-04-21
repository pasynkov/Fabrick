import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:5173', 'https://console.fabrick.me'],
    },
  });
  await app.init();
  return app;
}
