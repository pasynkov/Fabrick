import { Command, CommandRunner, Option } from 'nest-commander';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ApiService } from '../../api.service';
import { CredentialsService } from '../../credentials.service';
import { ConfigService } from '../../services/config.service';

interface CompendiumOptions {
  remote?: boolean;
}

@Command({ name: 'compendium', description: 'Print compendium pages' })
export class CompendiumCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
    private readonly configService: ConfigService,
  ) { super(); }

  @Option({ flags: '--remote', description: 'Fetch from backend instead of local cache' })
  parseRemote(): boolean { return true; }

  async run(_params: string[], options: CompendiumOptions = {}): Promise<void> {
    const config = this.configService.load();
    const creds = this.credentials.requireAuth();

    if (options.remote) {
      const apiUrl = config.apiUrl ?? creds.api_url;
      const res = await this.api.get<any>(apiUrl, `/v2/projects/${config.projectId}/compendium`, creds.token);
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    const compendiumDir = join(process.cwd(), '.fabrick', 'compendium');
    if (!existsSync(compendiumDir)) {
      console.error('No local compendium found. Use --remote to fetch from backend.');
      process.exit(1);
    }

    const files = readdirSync(compendiumDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      console.log(`\n=== ${file} ===`);
      console.log(readFileSync(join(compendiumDir, file), 'utf8'));
    }
  }
}
