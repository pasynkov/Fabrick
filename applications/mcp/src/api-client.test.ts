import { getSynthesisFile } from './api-client.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getSynthesisFile', () => {
  const apiUrl = 'http://localhost:3000';
  const token = 'fbrk_test-token';

  it('returns text content on 200 response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '# Index\n\nSome content',
    });

    const result = await getSynthesisFile(apiUrl, 'myorg', 'myproject', 'index.md', token);
    expect(result).toBe('# Index\n\nSome content');
  });

  it('calls correct URL with encoded params', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

    await getSynthesisFile(apiUrl, 'my org', 'my project', 'cross-cutting/envs.md', token);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/orgs/my%20org/projects/my%20project/synthesis/file');
    expect(calledUrl).toContain('path=cross-cutting%2Fenvs.md');
  });

  it('forwards token as Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

    await getSynthesisFile(apiUrl, 'myorg', 'myproject', 'index.md', token);

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect((calledOptions.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${token}`);
  });

  it('throws on non-200 response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(
      getSynthesisFile(apiUrl, 'myorg', 'myproject', 'missing.md', token),
    ).rejects.toThrow('API returned 404');
  });
});
