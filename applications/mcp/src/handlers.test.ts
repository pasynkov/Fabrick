// Tool handler logic extracted for testing
// The fabrick_search handler in index.ts uses searchProject and returns MCP tool result format

import { searchProject } from './api-client.js';

jest.mock('./api-client.js', () => ({
  searchProject: jest.fn(),
  getSynthesisPage: jest.fn(),
}));

const mockSearchProject = searchProject as jest.Mock;

// Inline handler logic (matches index.ts fabrick_search handler)
async function handleFabrickSearch(
  apiUrl: string,
  org: string,
  project: string,
  token: string,
  args: Record<string, unknown>,
) {
  const question = args?.question as string | undefined;
  if (!question) return { content: [{ type: 'text', text: 'Error: question argument is required' }] };
  try {
    const { answer, sources } = await searchProject(apiUrl, org, project, question, token);
    const sourcesText = sources.length > 0 ? `\n\nSources: ${sources.join(', ')}` : '';
    return { content: [{ type: 'text', text: `${answer}${sourcesText}` }] };
  } catch {
    return { content: [{ type: 'text', text: `Search failed for project '${project}'. Ensure synthesis has run and an API key is configured.` }] };
  }
}

const apiUrl = 'http://localhost:3000';
const org = 'myorg';
const project = 'myproject';
const token = 'fbrk_test-token';

beforeEach(() => {
  mockSearchProject.mockReset();
});

describe('fabrick_search handler', () => {
  it('calls searchProject with question and returns answer', async () => {
    mockSearchProject.mockResolvedValue({ answer: 'Auth uses JWT tokens', sources: ['logic/auth-flow'] });

    const result = await handleFabrickSearch(apiUrl, org, project, token, { question: 'how does auth work?' });

    expect(mockSearchProject).toHaveBeenCalledWith(apiUrl, org, project, 'how does auth work?', token);
    expect(result.content[0].text).toContain('Auth uses JWT tokens');
  });

  it('includes sources in response', async () => {
    mockSearchProject.mockResolvedValue({ answer: 'answer', sources: ['entities/user', 'logic/auth'] });

    const result = await handleFabrickSearch(apiUrl, org, project, token, { question: 'q' });

    expect(result.content[0].text).toContain('entities/user');
    expect(result.content[0].text).toContain('logic/auth');
  });

  it('returns error message when question not provided', async () => {
    const result = await handleFabrickSearch(apiUrl, org, project, token, {});

    expect(result.content[0].text).toBe('Error: question argument is required');
    expect(mockSearchProject).not.toHaveBeenCalled();
  });

  it('returns fallback message on API error', async () => {
    mockSearchProject.mockRejectedValue(new Error('Search API returned 400'));

    const result = await handleFabrickSearch(apiUrl, org, project, token, { question: 'q' });

    expect(result.content[0].text).toContain(`Search failed for project '${project}'`);
  });

  it('result is in MCP content array format', async () => {
    mockSearchProject.mockResolvedValue({ answer: 'answer', sources: [] });

    const result = await handleFabrickSearch(apiUrl, org, project, token, { question: 'q' });

    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
  });
});
