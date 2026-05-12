import { searchProject, getSynthesisPage } from './api-client.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('searchProject', () => {
  const apiUrl = 'http://localhost:3000';
  const token = 'fbrk_test-token';

  it('returns answer and sources on 200 response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'The endpoint is GET /users/:id', sources: ['entities/user'] }),
    });

    const result = await searchProject(apiUrl, 'myorg', 'myproject', 'where is user endpoint?', token);
    expect(result.answer).toBe('The endpoint is GET /users/:id');
    expect(result.sources).toEqual(['entities/user']);
  });

  it('calls correct URL with POST method', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: '', sources: [] }) });

    await searchProject(apiUrl, 'my org', 'my project', 'question', token);

    const [calledUrl, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('http://localhost:3000/v1/orgs/my%20org/projects/my%20project/search');
    expect(opts.method).toBe('POST');
  });

  it('sends question in JSON body', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: '', sources: [] }) });

    await searchProject(apiUrl, 'myorg', 'myproject', 'what is the auth flow?', token);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({ question: 'what is the auth flow?' });
  });

  it('forwards token as Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: '', sources: [] }) });

    await searchProject(apiUrl, 'myorg', 'myproject', 'q', token);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${token}`);
  });

  it('throws on non-200 response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 });

    await expect(
      searchProject(apiUrl, 'myorg', 'myproject', 'q', token),
    ).rejects.toThrow('Search API returned 400');
  });

  it('throws on 401 response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      searchProject(apiUrl, 'myorg', 'myproject', 'q', token),
    ).rejects.toThrow('Search API returned 401');
  });

  it('forwards fbrk_ prefixed token as-is in header', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: '', sources: [] }) });
    const prefixedToken = 'fbrk_some-jwt-token';

    await searchProject(apiUrl, 'myorg', 'myproject', 'q', prefixedToken);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${prefixedToken}`);
  });
});

describe('getSynthesisPage', () => {
  const apiUrl = 'http://localhost:3000';
  const token = 'fbrk_test-token';

  it('returns text content on 200 response', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => 'Use this tool to search...' });

    const result = await getSynthesisPage(apiUrl, 'myorg', 'myproject', 'mcp-description', token);
    expect(result).toBe('Use this tool to search...');
  });

  it('fetches requested page via synthesis/file endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

    await getSynthesisPage(apiUrl, 'myorg', 'myproject', 'mcp-description', token);

    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/synthesis/file');
    expect(calledUrl).toContain('mcp-description');
  });

  it('encodes path param in URL', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

    await getSynthesisPage(apiUrl, 'myorg', 'myproject', 'mcp-instructions', token);

    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('mcp-instructions');
  });

  it('throws on non-200 response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(
      getSynthesisPage(apiUrl, 'myorg', 'myproject', 'mcp-description', token),
    ).rejects.toThrow('API returned 404');
  });
});
