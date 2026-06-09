import { Command, CommandRunner, Option } from 'nest-commander';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ApiService } from '../../api.service';
import { CredentialsService } from '../../credentials.service';
import { ConfigService } from '../../services/config.service';

interface DossierOptions {
  remote?: boolean;
}

@Command({ name: 'dossier', description: 'Print dossier pages', arguments: '[scope]' })
export class DossierCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
    private readonly configService: ConfigService,
  ) { super(); }

  @Option({ flags: '--remote', description: 'Fetch from backend instead of local cache' })
  parseRemote(): boolean { return true; }

  async run(params: string[], options: DossierOptions = {}): Promise<void> {
    const scopeFilter = params[0];
    const config = this.configService.load();
    const creds = this.credentials.requireAuth();

    if (options.remote) {
      const apiUrl = config.apiUrl ?? creds.api_url;
      const res = await this.api.get<any>(apiUrl, `/v2/repos/${config.repoId}/dossier`, creds.token);
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    const dossierBase = join(process.cwd(), '.fabrick', 'dossier');
    if (!existsSync(dossierBase)) {
      console.error('No local dossier found. Run: fabrick regen (or use --remote)');
      process.exit(1);
    }

    const scopes = readdirSync(dossierBase, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((s) => !scopeFilter || s === scopeFilter || s.includes(scopeFilter));

    for (const scope of scopes) {
      const scopeDir = join(dossierBase, scope);
      const files = readdirSync(scopeDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        console.log(`\n=== ${scope}/${file} ===`);
        console.log(readFileSync(join(scopeDir, file), 'utf8'));
      }
    }
  }
}
