import * as appInsights from 'applicationinsights';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.setup().start();
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:5173', 'https://console.fabrick.me'],
    },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}
