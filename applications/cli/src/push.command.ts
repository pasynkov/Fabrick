import { Command, CommandRunner } from 'nest-commander';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
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

    if (!existsSync('.fabrick/wiki')) {
      console.error('No wiki found at .fabrick/wiki/. Run fabrick-analyze first.');
      process.exit(1);
    }

    console.log('Zipping wiki...');
    const zipBuffer = await this.zipWiki();

    const apiUrl = config.api_url || creds.api_url;
    const base = apiUrl.trim().replace(/\/$/, '');
    const url = `${base}/v1/repos/${config.repo_id}/context`;

    let triggerSynthesis = false;
    if (config.project_id) {
      let settings: ProjectSettings | null = null;
      try {
        settings = await this.api.get<ProjectSettings>(apiUrl, `/projects/${config.project_id}`, creds.token);
      } catch {
        // ignore — backend will handle based on its own settings
      }
      if (settings && !settings.autoSynthesisEnabled && settings.hasApiKey) {
        triggerSynthesis = await this.promptSynthesis();
      }
    }

    const { Blob } = await import('node:buffer');
    const form = new FormData();
    form.append('file', new Blob([zipBuffer], { type: 'application/zip' }) as globalThis.Blob, 'context.zip');
    if (triggerSynthesis) {
      form.append('triggerSynthesis', 'true');
    }

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
    console.log('✓ Wiki uploaded successfully');
    if (triggerSynthesis) {
      console.log('✓ Synthesis triggered');
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

  private zipWiki(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (chunk: Buffer) => chunks.push(chunk));
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);

      const archive = archiver.default('zip', { zlib: { level: 9 } });
      archive.pipe(pass);

      // Single app: zip .fabrick/wiki/ directly
      // Monorepo: discover per-app wikis and zip them under wiki/<app-name>/
      const singleWikiPath = '.fabrick/wiki';
      if (existsSync(singleWikiPath)) {
        archive.directory(singleWikiPath, false);
      } else {
        // Look for per-app wikis in apps/ or packages/
        const searchRoots = ['apps', 'packages'];
        let found = false;
        for (const searchRoot of searchRoots) {
          if (!existsSync(searchRoot)) continue;
          const apps: string[] = readdirSync(searchRoot).filter((d: string) => {
            try { return statSync(join(searchRoot, d)).isDirectory(); } catch { return false; }
          });
          for (const app of apps) {
            const appWiki = join(searchRoot, app, '.fabrick', 'wiki');
            if (existsSync(appWiki)) {
              archive.directory(appWiki, `wiki/${app}`);
              found = true;
            }
          }
        }
        if (!found) {
          reject(new Error('No wiki found. Run fabrick-analyze first.'));
          return;
        }
      }

      archive.finalize().catch(reject);
    });
  }
}
