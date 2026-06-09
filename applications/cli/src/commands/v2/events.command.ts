import { Command, CommandRunner, Option } from 'nest-commander';
import { ApiService } from '../../api.service';
import { CredentialsService } from '../../credentials.service';
import { ConfigService } from '../../services/config.service';

interface EventsOptions {
  since?: string;
  types?: string;
}

@Command({ name: 'events', description: 'List recent project events' })
export class EventsCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
    private readonly configService: ConfigService,
  ) { super(); }

  @Option({ flags: '--since <iso>', description: 'Filter events after this ISO timestamp' })
  parseSince(val: string): string { return val; }

  @Option({ flags: '--types <csv>', description: 'Comma-separated event types to filter' })
  parseTypes(val: string): string { return val; }

  async run(_params: string[], options: EventsOptions = {}): Promise<void> {
    const config = this.configService.load();
    const creds = this.credentials.requireAuth();
    const apiUrl = config.apiUrl ?? creds.api_url;

    const params = new URLSearchParams({ limit: '20' });
    if (options.since) params.set('since', options.since);
    if (options.types) params.set('types', options.types);

    const events = await this.api.get<any[]>(apiUrl, `/v2/projects/${config.projectId}/events?${params}`, creds.token);

    if (!events?.length) { console.log('No events found.'); return; }
    for (const e of events) {
      const title = e.title ?? e.type ?? '';
      console.log(`[${e.createdAt ?? ''}] ${e.type ?? ''} ${e.id ?? ''} ${title}`);
    }
  }
}
