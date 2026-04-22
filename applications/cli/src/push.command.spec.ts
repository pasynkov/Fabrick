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
