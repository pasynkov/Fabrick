import { Command, CommandRunner } from 'nest-commander';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';
import * as readline from 'readline';
import { ApiService } from './api.service';
import { CredentialsService } from './credentials.service';

interface Config { repo_id: string; project_id?: string; api_url: string }
interface ProjectSettings { autoSynthesisEnabled: boolean; hasApiKey: boolean }

@Command({ name: 'push', description: 'Upload context to Fabrick' })
export class PushCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
  ) {
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

    const { Blob } = await import('node:buffer');
    const form = new FormData();
    form.append('file', new Blob([zipBuffer], { type: 'application/zip' }) as globalThis.Blob, 'context.zip');

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

    await this.handleSynthesis(config, apiUrl, creds.token);
  }

  async handleSynthesis(config: Config, apiUrl: string, token: string): Promise<void> {
    const projectId = config.project_id;
    if (!projectId) return;

    let settings: ProjectSettings;
    try {
      settings = await this.api.get<ProjectSettings>(apiUrl, `/projects/${projectId}`, token);
    } catch {
      return;
    }

    if (!settings.hasApiKey) return;

    if (!settings.autoSynthesisEnabled) {
      const confirmed = await this.promptSynthesis();
      if (!confirmed) return;
    }

    try {
      await this.api.post<void>(apiUrl, `/projects/${projectId}/synthesis`, token, {});
      console.log('✓ Synthesis triggered');
    } catch (err: any) {
      console.error(`Synthesis trigger failed: ${err.message}`);
    }
  }

  promptSynthesis(): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('Run synthesis? (y/N) ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
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
