import { Controller, Get, HttpCode } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller('health')
export class HealthController {
  private readonly version: string;

  constructor() {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
    this.version = pkg.version;
  }

  @Get()
  @HttpCode(200)
  check() {
    return { status: 'ok', 'app-version': this.version };
  }
}
