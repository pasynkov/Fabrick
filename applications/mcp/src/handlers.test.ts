// Tool handler logic extracted for testing
// The handlers in index.ts use getSynthesisFile and return MCP tool result format

import { getSynthesisFile } from './api-client.js';

jest.mock('./api-client.js', () => ({
  getSynthesisFile: jest.fn(),
}));

const mockGetSynthesisFile = getSynthesisFile as jest.Mock;

// Inline handler logic (matches index.ts handlers)
async function handleGetSynthesisIndex(
  apiUrl: string,
  org: string,
  project: string,
  token: string,
) {
  try {
    const text = await getSynthesisFile(apiUrl, org, project, 'index.md', token);
    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `Synthesis not available for project '${project}'. Run synthesis first.` }] };
  }
}

async function handleGetSynthesisFile(
  apiUrl: string,
  org: string,
  project: string,
  token: string,
  args: Record<string, unknown>,
) {
  const path = args?.path as string | undefined;
  if (!path) return { content: [{ type: 'text', text: 'Error: path argument is required' }] };
  try {
    const text = await getSynthesisFile(apiUrl, org, project, path, token);
    return { content: [{ type: 'text', text }] };
  } catch {
    return { content: [{ type: 'text', text: `File '${path}' not found in synthesis for project '${project}'.` }] };
  }
}

const apiUrl = 'http://localhost:3000';
const org = 'myorg';
const project = 'myproject';
const token = 'fbrk_test-token';

beforeEach(() => {
  mockGetSynthesisFile.mockReset();
});

describe('get_synthesis_index handler', () => {
  it('calls getSynthesisFile with index.md and returns content', async () => {
    mockGetSynthesisFile.mockResolvedValue('# Index content');

    const result = await handleGetSynthesisIndex(apiUrl, org, project, token);

    expect(mockGetSynthesisFile).toHaveBeenCalledWith(apiUrl, org, project, 'index.md', token);
    expect(result.content[0].text).toBe('# Index content');
  });

  it('returns fallback message on error', async () => {
    mockGetSynthesisFile.mockRejectedValue(new Error('not found'));

    const result = await handleGetSynthesisIndex(apiUrl, org, project, token);

    expect(result.content[0].text).toContain(`Synthesis not available for project '${project}'`);
  });
});

describe('get_synthesis_file handler', () => {
  it('calls getSynthesisFile with provided path', async () => {
    mockGetSynthesisFile.mockResolvedValue('## Architecture');

    const result = await handleGetSynthesisFile(apiUrl, org, project, token, { path: 'arch.md' });

    expect(mockGetSynthesisFile).toHaveBeenCalledWith(apiUrl, org, project, 'arch.md', token);
    expect(result.content[0].text).toBe('## Architecture');
  });

  it('returns error message when path not provided', async () => {
    const result = await handleGetSynthesisFile(apiUrl, org, project, token, {});

    expect(result.content[0].text).toBe('Error: path argument is required');
    expect(mockGetSynthesisFile).not.toHaveBeenCalled();
  });

  it('returns not found message on API error', async () => {
    mockGetSynthesisFile.mockRejectedValue(new Error('API returned 404'));

    const result = await handleGetSynthesisFile(apiUrl, org, project, token, { path: 'missing.md' });

    expect(result.content[0].text).toContain(`File 'missing.md' not found`);
  });

  it('result is in MCP content array format', async () => {
    mockGetSynthesisFile.mockResolvedValue('content');

    const result = await handleGetSynthesisFile(apiUrl, org, project, token, { path: 'index.md' });

    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
  });
});
