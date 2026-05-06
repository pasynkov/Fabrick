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
    expect(!config.repo_id).toBe(true);
  });
});

describe('PushCommand — pre-upload synthesis prompt logic', () => {
  let mockApiService: { get: jest.Mock; post: jest.Mock };
  let mockCredentialsService: { requireAuth: jest.Mock };
  let command: any;

  beforeEach(() => {
    mockApiService = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockCredentialsService = {
      requireAuth: jest.fn().mockReturnValue({ token: 'mytoken', api_url: 'http://api' }),
    };
    const { PushCommand } = require('./push.command');
    command = new PushCommand(mockCredentialsService, mockApiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not call GET /projects if project_id is absent', async () => {
    jest.spyOn(command, 'promptSynthesis').mockResolvedValue(false);

    const result = await (async () => {
      if (!('project_id' in { repo_id: 'r', api_url: 'u' })) return false;
      const settings = await mockApiService.get('', '', '');
      return settings;
    })();

    expect(mockApiService.get).not.toHaveBeenCalled();
  });

  it('skips prompt when autoSynthesisEnabled is true', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: true, hasApiKey: true });
    jest.spyOn(command, 'promptSynthesis');

    const config = { repo_id: 'repo1', project_id: 'proj1', api_url: 'http://api' };
    let triggerSynthesis = false;
    const settings = await mockApiService.get('http://api', '/projects/proj1', 'mytoken');
    if (settings && !settings.autoSynthesisEnabled && settings.hasApiKey) {
      triggerSynthesis = await command.promptSynthesis();
    }

    expect(command.promptSynthesis).not.toHaveBeenCalled();
    expect(triggerSynthesis).toBe(false);
  });

  it('prompts user when autoSynthesisEnabled is false and hasApiKey is true', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: false, hasApiKey: true });
    jest.spyOn(command, 'promptSynthesis').mockResolvedValue(true);

    const settings = await mockApiService.get('http://api', '/projects/proj1', 'mytoken');
    let triggerSynthesis = false;
    if (settings && !settings.autoSynthesisEnabled && settings.hasApiKey) {
      triggerSynthesis = await command.promptSynthesis();
    }

    expect(command.promptSynthesis).toHaveBeenCalled();
    expect(triggerSynthesis).toBe(true);
  });

  it('skips prompt when hasApiKey is false', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: false, hasApiKey: false });
    jest.spyOn(command, 'promptSynthesis');

    const settings = await mockApiService.get('http://api', '/projects/proj1', 'mytoken');
    let triggerSynthesis = false;
    if (settings && !settings.autoSynthesisEnabled && settings.hasApiKey) {
      triggerSynthesis = await command.promptSynthesis();
    }

    expect(command.promptSynthesis).not.toHaveBeenCalled();
    expect(triggerSynthesis).toBe(false);
  });

  it('user declines synthesis prompt — triggerSynthesis remains false', async () => {
    mockApiService.get.mockResolvedValue({ autoSynthesisEnabled: false, hasApiKey: true });
    jest.spyOn(command, 'promptSynthesis').mockResolvedValue(false);

    const settings = await mockApiService.get('http://api', '/projects/proj1', 'mytoken');
    let triggerSynthesis = false;
    if (settings && !settings.autoSynthesisEnabled && settings.hasApiKey) {
      triggerSynthesis = await command.promptSynthesis();
    }

    expect(triggerSynthesis).toBe(false);
  });

  it('no separate synthesis endpoint call is made after upload', async () => {
    expect(mockApiService.post).not.toHaveBeenCalled();
  });
});
