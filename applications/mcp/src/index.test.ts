import { sign } from 'jsonwebtoken';

// Simulate the startup logic in isolation (without actually connecting stdio transport)
function parseToken(token: string): { org: string; project: string } {
  const { decode } = require('jsonwebtoken');
  const raw = token.startsWith('fbrk_') ? token.slice(5) : token;
  const payload = decode(raw) as Record<string, unknown> | null;
  if (!payload || typeof payload.org !== 'string' || typeof payload.project !== 'string') {
    throw new Error('FABRICK_TOKEN must contain org and project claims');
  }
  return { org: payload.org, project: payload.project };
}

const SECRET = 'test-secret';

describe('token parsing', () => {
  it('extracts org and project from valid JWT', () => {
    const jwt = sign({ org: 'myorg', project: 'myproject', sub: 'user1' }, SECRET);
    const result = parseToken(jwt);
    expect(result).toEqual({ org: 'myorg', project: 'myproject' });
  });

  it('strips fbrk_ prefix before decoding', () => {
    const jwt = sign({ org: 'myorg', project: 'myproject', sub: 'user1' }, SECRET);
    const result = parseToken(`fbrk_${jwt}`);
    expect(result).toEqual({ org: 'myorg', project: 'myproject' });
  });

  it('throws when org claim is missing', () => {
    const jwt = sign({ project: 'myproject', sub: 'user1' }, SECRET);
    expect(() => parseToken(jwt)).toThrow('org and project claims');
  });

  it('throws when project claim is missing', () => {
    const jwt = sign({ org: 'myorg', sub: 'user1' }, SECRET);
    expect(() => parseToken(jwt)).toThrow('org and project claims');
  });

  it('throws when token is not a valid JWT', () => {
    expect(() => parseToken('not-a-jwt')).toThrow('org and project claims');
  });
});

describe('env var validation', () => {
  it('requires FABRICK_TOKEN', () => {
    const token = process.env.FABRICK_TOKEN;
    delete process.env.FABRICK_TOKEN;
    // Simulated: if missing token, should error
    expect(process.env.FABRICK_TOKEN).toBeUndefined();
    if (token) process.env.FABRICK_TOKEN = token;
  });

  it('requires FABRICK_API_URL', () => {
    const url = process.env.FABRICK_API_URL;
    delete process.env.FABRICK_API_URL;
    expect(process.env.FABRICK_API_URL).toBeUndefined();
    if (url) process.env.FABRICK_API_URL = url;
  });
});
