import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { parse, stringify } from 'yaml';

export interface Credentials {
  token: string;
  api_url: string;
}

@Injectable()
export class CredentialsService {
  private readonly localPath = join(process.cwd(), '.fabrick', 'credentials.yaml');
  private readonly globalPath = join(homedir(), '.fabrick', 'credentials.yaml');

  read(): Credentials | null {
    const path = existsSync(this.localPath) ? this.localPath : this.globalPath;
    if (!existsSync(path)) return null;
    try {
      return parse(readFileSync(path, 'utf8')) as Credentials;
    } catch {
      return null;
    }
  }

  write(creds: Credentials): void {
    mkdirSync(dirname(this.localPath), { recursive: true });
    writeFileSync(this.localPath, stringify(creds), { encoding: 'utf8' });
    chmodSync(this.localPath, 0o600);
  }

  requireAuth(): Credentials {
    const creds = this.read();
    if (!creds?.token) {
      console.error('Not authenticated. Run: fabrick login');
      process.exit(1);
    }
    return creds;
  }
}
