import { Command, CommandRunner } from 'nest-commander';
import { ApiService } from '../../api.service';
import { CredentialsService } from '../../credentials.service';

interface MeResponse {
  id: string;
  email?: string;
  orgs?: Array<{ name: string; slug: string }>;
}

@Command({ name: 'whoami', description: 'Print authenticated user identity' })
export class WhoamiCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const creds = this.credentials.read();
    if (!creds?.token) {
      console.error('Not authenticated. Run: fabrick login');
      process.exit(1);
    }

    let me: MeResponse;
    try {
      me = await this.api.get<MeResponse>(creds.api_url, '/me', creds.token);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized')) {
        console.error(`Authentication invalid: ${err.message}`);
        console.error('Run: fabrick login');
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }

    console.log(`id: ${me.id}`);
    if (me.email) console.log(`email: ${me.email}`);
    if (me.orgs?.length) {
      console.log('orgs:');
      for (const org of me.orgs) {
        console.log(`  ${org.name} (${org.slug})`);
      }
    }
  }
}
