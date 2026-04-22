// Tests fbrk_ token auth flow end-to-end through getSynthesisFile
// The MCP server passes token as-is (with fbrk_ prefix) to API.
// The API's FabrickAuthGuard strips the prefix before JWT verification.
// This test verifies the contract from MCP side: token forwarded unmodified.

import { getSynthesisFile } from './api-client.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('MCP auth — fbrk_ token forwarding', () => {
  it('forwards fbrk_ token as Bearer in Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => '# content' });

    await getSynthesisFile('http://localhost:3000', 'myorg', 'myproject', 'index.md', 'fbrk_eyJhbGci.payload.sig');

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer fbrk_eyJhbGci.payload.sig');
  });

  it('API receives token with fbrk_ prefix intact (not stripped by MCP)', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

    const token = 'fbrk_some-long-jwt-token';
    await getSynthesisFile('http://localhost:3000', 'org', 'proj', 'file.md', token);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const authHeader = (opts.headers as Record<string, string>)['Authorization'];
    // MCP does NOT strip the prefix — that's the API guard's job
    expect(authHeader).toBe(`Bearer ${token}`);
    expect(authHeader).toContain('fbrk_');
  });

  it('returns 401 response as thrown error (API rejected token)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      getSynthesisFile('http://localhost:3000', 'org', 'proj', 'file.md', 'fbrk_bad'),
    ).rejects.toThrow('API returned 401');
  });

  it('calls correct synthesis file endpoint for MCP tool', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => '# Index' });

    await getSynthesisFile('http://api.fabrick.me', 'myorg', 'myproject', 'index.md', 'fbrk_tok');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.fabrick.me/orgs/myorg/projects/myproject/synthesis/file?path=index.md');
  });
});
