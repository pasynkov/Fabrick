import { Command, CommandRunner } from 'nest-commander';
import simpleGit from 'simple-git';
import { ConfigService } from '../../services/config.service';
import { StateService } from '../../services/state.service';
import { APP_PAGE_SLUGS } from '../../pipeline/llm/prompts';

@Command({ name: 'status', description: 'Print local sync state' })
export class StatusCommand extends CommandRunner {
  constructor(
    private readonly configService: ConfigService,
    private readonly stateService: StateService,
  ) { super(); }

  async run(): Promise<void> {
    const cwd = process.cwd();
    const config = this.configService.load();
    const state = this.stateService.load();

    console.log(`repo: ${config.repoName} (${config.repoId})`);
    console.log(`baselineSha: ${state.baselineSha ?? '(none)'}`);
    console.log(`lastSyncedAt: ${state.lastSyncedAt ?? '(never)'}`);
    console.log(`lastDossierUpdatedId: ${state.lastDossierUpdatedId ?? '(none)'}`);

    // Dirty scopes
    if (state.baselineSha) {
      try {
        const git = simpleGit(cwd);
        const diff = await git.diff([`${state.baselineSha}..HEAD`, '--name-only']);
        const changedFiles = diff.split('\n').map((l) => l.trim()).filter(Boolean);
        const dirtyScopes = (state.scopes ?? []).filter((scope) =>
          changedFiles.some((f) => scope.root === '.' || f.startsWith(scope.root))
        );
        if (dirtyScopes.length) {
          console.log('dirty scopes:');
          for (const s of dirtyScopes) console.log(`  ${s.root}`);
        } else {
          console.log('dirty scopes: (none)');
        }
      } catch { /* ignore git errors */ }
    }
  }
}
