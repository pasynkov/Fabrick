// Integration test: MCP tool handlers → getSynthesisFile → API
// Uses a real HTTP server (http.createServer) to mock the Fabrick API

import * as http from 'http';
import { getSynthesisFile } from '../src/api-client.js';

// Restore native fetch (Node 18+) so this integration test makes real HTTP calls.
// Other test files set global.fetch = jest.fn() — reset it here.
beforeAll(() => {
  if (typeof globalThis.fetch !== 'function' || (globalThis.fetch as any).mock) {
    const { fetch: nativeFetch } = require('undici');
    (global as any).fetch = nativeFetch;
  }
});

function startMockApiServer(responses: Record<string, { status: number; body: string }>): Promise<{
  url: string;
  close: () => void;
  requests: Array<{ url: string; headers: Record<string, string> }>;
}> {
  const requests: Array<{ url: string; headers: Record<string, string> }> = [];

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requests.push({
        url: req.url || '',
        headers: req.headers as Record<string, string>,
      });

      const key = req.url || '';
      const match = Object.keys(responses).find((pattern) => key.includes(pattern));
      const response = match ? responses[match] : { status: 404, body: 'Not found' };

      res.writeHead(response.status, { 'Content-Type': 'text/plain' });
      res.end(response.body);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => server.close(),
        requests,
      });
    });
  });
}

describe('MCP integration — getSynthesisFile against real HTTP', () => {
  it('fetches synthesis index from real HTTP server', async () => {
    const { url, close, requests } = await startMockApiServer({
      '/synthesis/file': { status: 200, body: '# Project Index\n\nSection 1' },
    });

    try {
      const result = await getSynthesisFile(url, 'myorg', 'myproject', 'index.md', 'fbrk_test-token');

      expect(result).toBe('# Project Index\n\nSection 1');
      expect(requests[0].headers['authorization']).toBe('Bearer fbrk_test-token');
      expect(requests[0].url).toContain('/orgs/myorg/projects/myproject/synthesis/file');
      expect(requests[0].url).toContain('path=index.md');
    } finally {
      close();
    }
  });

  it('throws on 404 from real HTTP server', async () => {
    const { url, close } = await startMockApiServer({});

    try {
      await expect(
        getSynthesisFile(url, 'org', 'proj', 'missing.md', 'fbrk_tok'),
      ).rejects.toThrow('API returned 404');
    } finally {
      close();
    }
  });

  it('throws on 401 (token rejected)', async () => {
    const { url, close } = await startMockApiServer({
      '/synthesis/file': { status: 401, body: 'Unauthorized' },
    });

    try {
      await expect(
        getSynthesisFile(url, 'org', 'proj', 'index.md', 'fbrk_bad-token'),
      ).rejects.toThrow('API returned 401');
    } finally {
      close();
    }
  });

  it('encodes special chars in org/project names in URL', async () => {
    const { url, close, requests } = await startMockApiServer({
      '/synthesis/file': { status: 200, body: 'content' },
    });

    try {
      await getSynthesisFile(url, 'my org', 'my project', 'cross-cutting/envs.md', 'tok');

      expect(requests[0].url).toContain('/orgs/my%20org/projects/my%20project/synthesis/file');
      expect(requests[0].url).toContain('path=cross-cutting%2Fenvs.md');
    } finally {
      close();
    }
  });
});
