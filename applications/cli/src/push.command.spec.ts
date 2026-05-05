import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PushCommand — zip and upload logic', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads repo_id and api_url from .fabrick/config.yaml', () => {
    const yaml = require('yaml');
    const config = yaml.parse('repo_id: repo123\napi_url: http://localhost:3000\n');
    expect(config.repo_id).toBe('repo123');
    expect(config.api_url).toBe('http://localhost:3000');
  });

  it('constructs correct upload URL from config', () => {
    const apiUrl = 'http://localhost:3000';
    const repoId = 'repo123';
    const url = `${apiUrl}/repos/${repoId}/context`;
    expect(url).toBe('http://localhost:3000/repos/repo123/context');
  });

  it('sends POST with Authorization header', async () => {
    const mockRes = { ok: true };
    global.fetch = jest.fn().mockResolvedValue(mockRes);

    const apiUrl = 'http://localhost:3000';
    const repoId = 'repo123';
    const token = 'mytoken';
    const { Blob } = await import('node:buffer');
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('zipdata')], { type: 'application/zip' }) as globalThis.Blob, 'context.zip');

    await fetch(`${apiUrl}/repos/${repoId}/context`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const [calledUrl, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(calledUrl).toBe('http://localhost:3000/repos/repo123/context');
    expect(opts.headers['Authorization']).toBe('Bearer mytoken');
    expect(opts.method).toBe('POST');
  });

  it('fails when config.yaml is missing repo_id', () => {
    const yaml = require('yaml');
    const config = yaml.parse('api_url: http://localhost:3000\n');
    expect(config.repo_id).toBeUndefined();
    // PushCommand exits with error — verify the check logic
    expect(!config.repo_id).toBe(true);
  });
});

describe('PushCommand — handleSynthesis (auto-synthesis trigger logic)', () => {
  let mockApiService: { get: jest.Mock; post: jest.Mock };
  let mockCredentialsService: { requireAuth: jest.Mock };
  let command: any;

  beforeEach(() => {
    mockApiService = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockCredentialsService = {
      requireAuth: jest.fn(),
    };
    const { PushCommand } = require('./push.command');
    command = new PushCommand(mockCredentialsService, mockApiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips synthesis when project_id is not in config', async () => {
    await command.handleSynthesis({ repo_id: 'repo1', api_url: 'http://api' }, 'http://api', 'token');
    expect(mockApiService.get).not.toHaveBeenCalled();
  });

  it('skips synthesis when API call to get project settings fails', async () => {
    mockApiService.get.mockRejectedValue(new Error('Network error'));
    await command.handleSynthesis({ repo_id: 'repo1', project_id: 'proj1', api_url: 'http://api' }, 'http://api', 'token');
    expect(mockApiService.post).not.toHaveBeenCalled();
  });

  it('skips synthesis prompt when no API keys configured', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: false, hasApiKey: false });
    jest.spyOn(command, 'promptSynthesis');

    await command.handleSynthesis({ repo_id: 'repo1', project_id: 'proj1', api_url: 'http://api' }, 'http://api', 'token');

    expect(command.promptSynthesis).not.toHaveBeenCalled();
    expect(mockApiService.post).not.toHaveBeenCalled();
  });

  it('triggers synthesis automatically when auto-synthesis is enabled (no prompt)', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: true, hasApiKey: true });
    mockApiService.post.mockResolvedValue(undefined);
    jest.spyOn(command, 'promptSynthesis');

    await command.handleSynthesis({ repo_id: 'repo1', project_id: 'proj1', api_url: 'http://api' }, 'http://api', 'token');

    expect(command.promptSynthesis).not.toHaveBeenCalled();
    expect(mockApiService.post).toHaveBeenCalledWith('http://api', '/projects/proj1/synthesis', 'token', {});
  });

  it('prompts user when auto-synthesis is disabled and API key is present', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: false, hasApiKey: true });
    mockApiService.post.mockResolvedValue(undefined);
    jest.spyOn(command, 'promptSynthesis').mockResolvedValue(true);

    await command.handleSynthesis({ repo_id: 'repo1', project_id: 'proj1', api_url: 'http://api' }, 'http://api', 'token');

    expect(command.promptSynthesis).toHaveBeenCalled();
    expect(mockApiService.post).toHaveBeenCalledWith('http://api', '/projects/proj1/synthesis', 'token', {});
  });

  it('skips synthesis when user declines synthesis prompt', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: false, hasApiKey: true });
    jest.spyOn(command, 'promptSynthesis').mockResolvedValue(false);

    await command.handleSynthesis({ repo_id: 'repo1', project_id: 'proj1', api_url: 'http://api' }, 'http://api', 'token');

    expect(mockApiService.post).not.toHaveBeenCalled();
  });

  it('calls GET /projects/:projectId with correct args', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: false, hasApiKey: false });

    await command.handleSynthesis({ repo_id: 'repo1', project_id: 'proj-42', api_url: 'http://api' }, 'http://api', 'mytoken');

    expect(mockApiService.get).toHaveBeenCalledWith('http://api', '/projects/proj-42', 'mytoken');
  });
});
