import { Module } from '@nestjs/common';
import { ApiService } from './api.service';
import { CredentialsService } from './credentials.service';
import { InitCommand } from './init.command';
import { LoginCommand } from './login.command';
import { PushCommand } from './push.command';

@Module({
  providers: [
    CredentialsService,
    ApiService,
    LoginCommand,
    InitCommand,
    PushCommand,
  ],
})
export class CliModule {}
