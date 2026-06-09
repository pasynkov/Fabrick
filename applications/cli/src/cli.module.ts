import { Module } from '@nestjs/common';
import { ApiService } from './api.service';
import { CredentialsService } from './credentials.service';
import { InitCommand } from './init.command';
import { LoginCommand } from './login.command';
import { ConfigService } from './services/config.service';
import { StateService } from './services/state.service';
import { ClaudeCodeService } from './pipeline/llm/claude-code.service';
import { FrontmatterService } from './pipeline/frontmatter.service';
import { IndexService } from './pipeline/index.service';
import { PatchLogService } from './pipeline/patch-log.service';
import { SummarizeScopeService } from './pipeline/summarize-scope.service';
import { LogoutCommand } from './commands/v2/logout.command';
import { WhoamiCommand } from './commands/v2/whoami.command';
import { BootstrapCommand } from './commands/v2/bootstrap.command';
import { SyncCommand } from './commands/v2/sync.command';
import { RegenCommand } from './commands/v2/regen.command';
import { StatusCommand } from './commands/v2/status.command';
import { EventsCommand } from './commands/v2/events.command';
import { SearchCommand } from './commands/v2/search.command';
import { DossierCommand } from './commands/v2/dossier.command';
import { CompendiumCommand } from './commands/v2/compendium.command';
import { ConfigCommand } from './commands/v2/config.command';

@Module({
  providers: [
    // Core services
    CredentialsService,
    ApiService,
    ConfigService,
    StateService,
    // Pipeline services
    ClaudeCodeService,
    FrontmatterService,
    IndexService,
    PatchLogService,
    SummarizeScopeService,
    // Commands
    LoginCommand,
    InitCommand,
    LogoutCommand,
    WhoamiCommand,
    BootstrapCommand,
    SyncCommand,
    RegenCommand,
    StatusCommand,
    EventsCommand,
    SearchCommand,
    DossierCommand,
    CompendiumCommand,
    ConfigCommand,
  ],
})
export class CliModule {}
