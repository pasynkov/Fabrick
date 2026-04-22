import { ApiService } from './api.service';
import { CredentialsService } from './credentials.service';

// Test ApiService call patterns used by InitCommand
describe('InitCommand — API call patterns', () => {
  let apiService: ApiService;

  beforeEach(() => {
    apiService = new ApiService();
  });

  function mockFetch(responses: Array<{ status: number; body: unknown }>) {
    let callIndex = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      const r = responses[callIndex++] || { status: 200, body: {} };
      return Promise.resolve({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: jest.fn().mockResolvedValue(r.body),
        text: jest.fn().mockResolvedValue(JSON.stringify(r.body)),
      });
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /orgs returns org list', async () => {
    const orgs = [{ id: 'org1', name: 'Acme', slug: 'acme', role: 'admin' }];
    mockFetch([{ status: 200, body: orgs }]);

    const result = await apiService.get('http://localhost:3000', '/orgs', 'token');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/orgs',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    );
    expect(result).toEqual(orgs);
  });

  it('POST /orgs/:id/projects creates project', async () => {
    const project = { id: 'proj1', name: 'My Project', slug: 'my-project' };
    mockFetch([{ status: 201, body: project }]);

    const result = await apiService.post('http://localhost:3000', '/orgs/org1/projects', 'token', { name: 'My Project' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/orgs/org1/projects',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(project);
  });

  it('POST /repos/find-or-create registers repo', async () => {
    const repo = { id: 'repo1', name: 'myrepo', slug: 'myrepo', gitRemote: 'github.com/org/myrepo', projectId: 'proj1' };
    mockFetch([{ status: 200, body: repo }]);

    const result = await apiService.post(
      'http://localhost:3000',
      '/repos/find-or-create',
      'token',
      { gitRemote: 'https://github.com/org/myrepo.git', projectId: 'proj1' },
    );

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://localhost:3000/repos/find-or-create');
    expect(JSON.parse(opts.body)).toMatchObject({ gitRemote: 'https://github.com/org/myrepo.git', projectId: 'proj1' });
    expect(result).toEqual(repo);
  });

  it('POST /auth/mcp-token issues MCP token', async () => {
    const tokenRes = { token: 'fbrk_mcp-token' };
    mockFetch([{ status: 201, body: tokenRes }]);

    const result = await apiService.post(
      'http://localhost:3000',
      '/auth/mcp-token',
      'token',
      { orgSlug: 'acme', projectSlug: 'my-project', repoId: 'repo1' },
    );

    expect(result).toEqual(tokenRes);
  });
});
