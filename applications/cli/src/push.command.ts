import { Command, CommandRunner } from 'nest-commander';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';
import { CredentialsService } from './credentials.service';

interface Config { repo_id: string; api_url: string }

@Command({ name: 'push', description: 'Upload context to Fabrick' })
export class PushCommand extends CommandRunner {
  constructor(private readonly credentials: CredentialsService) {
    super();
  }

  async run(): Promise<void> {
    const creds = this.credentials.requireAuth();

    if (!existsSync('.fabrick/config.yaml')) {
      console.error('Not initialized. Run: fabrick init');
      process.exit(1);
    }
    const config = parse(readFileSync('.fabrick/config.yaml', 'utf8')) as Config;
    if (!config.repo_id) {
      console.error('Invalid config: missing repo_id');
      process.exit(1);
    }

    if (!existsSync('.fabrick/context')) {
      console.error('No context found at .fabrick/context/. Run fabrick analyze first.');
      process.exit(1);
    }

    console.log('Zipping context...');
    const zipBuffer = await this.zipContext();

    const apiUrl = config.api_url || creds.api_url;
    const url = `${apiUrl}/repos/${config.repo_id}/context`;

    const { FormData, Blob } = await import('node:buffer') as any;
    const form = new FormData();
    form.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'context.zip');

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.token}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Upload failed: ${res.status} ${body}`);
      process.exit(1);
    }
    console.log('✓ Context uploaded successfully');
  }

  private zipContext(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (chunk: Buffer) => chunks.push(chunk));
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);

      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(pass);
      archive.directory('.fabrick/context/', false);
      archive.finalize().catch(reject);
    });
  }
}
