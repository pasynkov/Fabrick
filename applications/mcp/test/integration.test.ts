// Integration test: MCP tool handlers → searchProject → API
// Uses a real HTTP server (http.createServer) to mock the Fabrick API

import * as http from 'http';
import { searchProject, getSynthesisPage } from '../src/api-client.js';

// Restore native fetch (Node 18+) so this integration test makes real HTTP calls.
// Other test files set global.fetch = jest.fn() — reset it here.
beforeAll(() => {
  if (typeof globalThis.fetch !== 'function' || (globalThis.fetch as any).mock) {
    const { fetch: nativeFetch } = require('undici');
    (global as any).fetch = nativeFetch;
  }
});

function startMockApiServer(responses: Record<string, { status: number; body: string; contentType?: string }>): Promise<{
  url: string;
  close: () => void;
  requests: Array<{ url: string; headers: Record<string, string>; body: string }>;
}> {
  const requests: Array<{ url: string; headers: Record<string, string>; body: string }> = [];

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        requests.push({
          url: req.url || '',
          headers: req.headers as Record<string, string>,
          body,
        });

        const key = req.url || '';
        const match = Object.keys(responses).find((pattern) => key.includes(pattern));
        const response = match ? responses[match] : { status: 404, body: 'Not found', contentType: 'text/plain' };

        res.writeHead(response.status, { 'Content-Type': response.contentType ?? 'application/json' });
        res.end(response.body);
      });
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

describe('MCP integration — searchProject against real HTTP', () => {
  it('posts question and returns answer from real HTTP server', async () => {
    const responseBody = JSON.stringify({ answer: 'Auth uses JWT', sources: ['logic/auth-flow'] });
    const { url, close, requests } = await startMockApiServer({
      '/search': { status: 200, body: responseBody },
    });

    try {
      const result = await searchProject(url, 'myorg', 'myproject', 'how does auth work?', 'fbrk_test-token');

      expect(result.answer).toBe('Auth uses JWT');
      expect(result.sources).toEqual(['logic/auth-flow']);
      expect(requests[0].headers['authorization']).toBe('Bearer fbrk_test-token');
      expect(requests[0].url).toBe('/v1/orgs/myorg/projects/myproject/search');
      expect(JSON.parse(requests[0].body)).toEqual({ question: 'how does auth work?' });
    } finally {
      close();
    }
  });

  it('throws on 400 from real HTTP server', async () => {
    const { url, close } = await startMockApiServer({
      '/search': { status: 400, body: 'Bad request' },
    });

    try {
      await expect(
        searchProject(url, 'org', 'proj', 'q', 'fbrk_tok'),
      ).rejects.toThrow('Search API returned 400');
    } finally {
      close();
    }
  });

  it('throws on 401 (token rejected)', async () => {
    const { url, close } = await startMockApiServer({
      '/search': { status: 401, body: 'Unauthorized' },
    });

    try {
      await expect(
        searchProject(url, 'org', 'proj', 'q', 'fbrk_bad-token'),
      ).rejects.toThrow('Search API returned 401');
    } finally {
      close();
    }
  });

  it('encodes special chars in org/project names in URL', async () => {
    const { url, close, requests } = await startMockApiServer({
      '/search': { status: 200, body: JSON.stringify({ answer: 'ok', sources: [] }) },
    });

    try {
      await searchProject(url, 'my org', 'my project', 'q', 'tok');

      expect(requests[0].url).toBe('/v1/orgs/my%20org/projects/my%20project/search');
    } finally {
      close();
    }
  });
});

describe('MCP integration — getSynthesisPage against real HTTP', () => {
  it('fetches requested page and returns text', async () => {
    const { url, close, requests } = await startMockApiServer({
      '/synthesis/file': { status: 200, body: 'Use fabrick_search to query...', contentType: 'text/plain' },
    });

    try {
      const result = await getSynthesisPage(url, 'myorg', 'myproject', 'mcp-description', 'fbrk_test-token');

      expect(result).toBe('Use fabrick_search to query...');
      expect(requests[0].url).toContain('/synthesis/file');
      expect(requests[0].url).toContain('mcp-description');
    } finally {
      close();
    }
  });

  it('throws on 404 when page not found', async () => {
    const { url, close } = await startMockApiServer({});

    try {
      await expect(
        getSynthesisPage(url, 'org', 'proj', 'mcp-description', 'fbrk_tok'),
      ).rejects.toThrow('API returned 404');
    } finally {
      close();
    }
  });
});
