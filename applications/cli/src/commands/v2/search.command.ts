import { Command, CommandRunner, Option } from 'nest-commander';
import { ApiService } from '../../api.service';
import { CredentialsService } from '../../credentials.service';
import { ConfigService } from '../../services/config.service';

interface SearchOptions {
  reasoning?: boolean;
}

@Command({ name: 'search', description: 'Search the dossier via AI', arguments: '<question>' })
export class SearchCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
    private readonly configService: ConfigService,
  ) { super(); }

  @Option({ flags: '--reasoning', description: 'Enable reasoning mode' })
  parseReasoning(): boolean { return true; }

  async run(params: string[], options: SearchOptions = {}): Promise<void> {
    const question = params[0];
    if (!question) { console.error('Usage: fabrick search "<question>"'); process.exit(1); }

    const config = this.configService.load();
    const creds = this.credentials.requireAuth();
    const apiUrl = config.apiUrl ?? creds.api_url;

    const res = await this.api.post<{ answer: string; sources?: string[] }>(
      apiUrl,
      `/v2/projects/${config.projectId}/search`,
      creds.token,
      { question, reasoning: options.reasoning ?? false },
    );

    console.log(res.answer ?? '(no answer)');
    if (res.sources?.length) {
      console.log('\nsources:');
      for (const src of res.sources) console.log(`  ${src}`);
    }
  }
}
