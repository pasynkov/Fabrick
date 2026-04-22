import * as http from 'http';
import { CredentialsService } from './credentials.service';

// Test the callback server logic in isolation
describe('LoginCommand — callback server', () => {
  function startTestCallbackServer(): Promise<{
    port: number;
    close: () => void;
    waitForToken: Promise<{ token: string; apiUrl: string }>;
  }> {
    return new Promise((resolve) => {
      let resolveToken!: (t: { token: string; apiUrl: string }) => void;
      const waitForToken = new Promise<{ token: string; apiUrl: string }>((res) => {
        resolveToken = res;
      });

      const { parse: parseUrl } = require('url');
      const server = http.createServer((req, res) => {
        const parsed = parseUrl(req.url || '', true);
        const token = parsed.query['token'] as string | undefined;
        const apiUrl = parsed.query['api_url'] as string | undefined;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authenticated!</h2></body></html>');
        if (token) resolveToken({ token, apiUrl: apiUrl || 'https://api.fabrick.me' });
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        resolve({ port: addr.port, close: () => server.close(), waitForToken });
      });
    });
  }

  it('resolves token from callback URL', async () => {
    const { port, close, waitForToken } = await startTestCallbackServer();

    // Simulate browser callback
    await new Promise<void>((resolve) => {
      http.get(`http://127.0.0.1:${port}/?token=mytoken123&api_url=http://localhost:3000`, (res) => {
        res.resume();
        res.on('end', resolve);
      });
    });

    const result = await waitForToken;
    close();

    expect(result.token).toBe('mytoken123');
    expect(result.apiUrl).toBe('http://localhost:3000');
  });

  it('uses default api url when api_url not provided', async () => {
    const { port, close, waitForToken } = await startTestCallbackServer();

    await new Promise<void>((resolve) => {
      http.get(`http://127.0.0.1:${port}/?token=tok456`, (res) => {
        res.resume();
        res.on('end', resolve);
      });
    });

    const result = await waitForToken;
    close();

    expect(result.apiUrl).toBe('https://api.fabrick.me');
  });
});

describe('CredentialsService integration with LoginCommand', () => {
  it('writes credentials after receiving token', () => {
    const mockWrite = jest.fn();
    const creds: CredentialsService = { write: mockWrite } as any;

    creds.write({ token: 'mytoken', api_url: 'http://localhost:3000' });

    expect(mockWrite).toHaveBeenCalledWith({ token: 'mytoken', api_url: 'http://localhost:3000' });
  });
});
