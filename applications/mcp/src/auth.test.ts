// Tests fbrk_ token auth flow end-to-end through searchProject
// The MCP server passes token as-is (with fbrk_ prefix) to API.
// The API's FabrickAuthGuard strips the prefix before JWT verification.
// This test verifies the contract from MCP side: token forwarded unmodified.

import { searchProject } from './api-client.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('MCP auth — fbrk_ token forwarding', () => {
  it('forwards fbrk_ token as Bearer in Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: '', sources: [] }) });

    await searchProject('http://localhost:3000', 'myorg', 'myproject', 'q', 'fbrk_eyJhbGci.payload.sig');

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer fbrk_eyJhbGci.payload.sig');
  });

  it('API receives token with fbrk_ prefix intact (not stripped by MCP)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: '', sources: [] }) });

    const token = 'fbrk_some-long-jwt-token';
    await searchProject('http://localhost:3000', 'org', 'proj', 'q', token);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const authHeader = (opts.headers as Record<string, string>)['Authorization'];
    // MCP does NOT strip the prefix — that's the API guard's job
    expect(authHeader).toBe(`Bearer ${token}`);
    expect(authHeader).toContain('fbrk_');
  });

  it('returns 401 response as thrown error (API rejected token)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      searchProject('http://localhost:3000', 'org', 'proj', 'q', 'fbrk_bad'),
    ).rejects.toThrow('Search API returned 401');
  });

  it('calls correct search endpoint for MCP tool', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: 'ok', sources: [] }) });

    await searchProject('http://api.fabrick.me', 'myorg', 'myproject', 'how does auth work?', 'fbrk_tok');

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.fabrick.me/v1/orgs/myorg/projects/myproject/search');
  });
});
