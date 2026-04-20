import { Command, CommandRunner } from 'nest-commander';
import { createServer } from 'http';
import { parse as parseUrl } from 'url';
import { exec } from 'child_process';
import { CredentialsService } from './credentials.service';

const DEFAULT_API_URL = process.env.FABRICK_API_URL || 'https://api.fabrick.me';
const CONSOLE_URL = process.env.FABRICK_CONSOLE_URL || 'https://console.fabrick.me';
const TIMEOUT_MS = 5 * 60 * 1000;

@Command({ name: 'login', description: 'Authenticate with Fabrick' })
export class LoginCommand extends CommandRunner {
  constructor(private readonly credentials: CredentialsService) {
    super();
  }

  async run(): Promise<void> {
    const { port, close, waitForToken } = await this.startCallbackServer();
    const state = Math.random().toString(36).slice(2);
    const url = `${CONSOLE_URL}/cli-auth?port=${port}&state=${state}`;

    console.log(`Opening browser: ${url}`);
    this.openBrowser(url);

    console.log('Waiting for authentication...');
    const token = await Promise.race([
      waitForToken,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for auth')), TIMEOUT_MS),
      ),
    ]).finally(close);

    this.credentials.write({ token, api_url: DEFAULT_API_URL });
    console.log('✓ Authenticated. Credentials saved to .fabrick/credentials.yaml');
    process.exit(0);
  }

  private startCallbackServer(): Promise<{
    port: number;
    close: () => void;
    waitForToken: Promise<string>;
  }> {
    return new Promise((resolve) => {
      let resolveToken!: (t: string) => void;
      const waitForToken = new Promise<string>((res) => { resolveToken = res; });

      const server = createServer((req, res) => {
        const parsed = parseUrl(req.url || '', true);
        const token = parsed.query['token'] as string | undefined;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authenticated! You can close this tab.</h2></body></html>');
        if (token) resolveToken(token);
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        resolve({
          port: addr.port,
          close: () => server.close(),
          waitForToken,
        });
      });
    });
  }

  private openBrowser(url: string): void {
    const platform = process.platform;
    const cmd =
      platform === 'darwin' ? `open "${url}"` :
      platform === 'win32' ? `start "${url}"` :
      `xdg-open "${url}"`;
    exec(cmd, (err) => {
      if (err) console.log(`Could not open browser. Open manually: ${url}`);
    });
  }
}
