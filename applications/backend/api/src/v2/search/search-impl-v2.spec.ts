import { SearchImplV2 } from '@app/shared';

const MOCK_PROMPT_RECORD = {
  id: 'prompt-rev-1',
  name: 'search-v2',
  agent: 'claude',
  revision: 1,
  content: { files: { 'prompt.md': 'You are a search agent.' } },
};

const MOCK_INDEX_PAGE = { slug: 'index', content: '# Index\n\nThis is the compendium index.' };

function makeCompendiumRepo(indexPage: any = MOCK_INDEX_PAGE) {
  return {
    findIndex: jest.fn().mockResolvedValue(indexPage),
    findBySlug: jest.fn().mockResolvedValue(null),
  };
}

function makeDossierRepo() {
  return {
    listScopes: jest.fn().mockResolvedValue([]),
    listInScope: jest.fn().mockResolvedValue([]),
    findPage: jest.fn().mockResolvedValue(null),
    findPages: jest.fn().mockResolvedValue([]),
  };
}

function makePromptRepo() {
  return {
    getLatest: jest.fn().mockResolvedValue(MOCK_PROMPT_RECORD),
  };
}

function makeAnthropicClient(responses: any[]) {
  let callIdx = 0;
  return {
    messages: {
      create: jest.fn().mockImplementation(() => {
        const resp = responses[callIdx];
        callIdx += 1;
        return Promise.resolve(resp);
      }),
    },
  };
}

function makeEndTurnResponse(text: string, inputTokens = 100, outputTokens = 50) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

function makeToolUseResponse(toolUses: Array<{ id: string; name: string; input: any }>, inputTokens = 100, outputTokens = 50) {
  return {
    stop_reason: 'tool_use',
    content: toolUses.map((tu) => ({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input })),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

describe('SearchImplV2', () => {
  describe('single-tool happy path', () => {
    it('dossier_read then end_turn returns qualified source', async () => {
      const compendiumRepo = makeCompendiumRepo();
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      const dossierPage = { repoSlug: 'backend-api', scope: 'web', slug: 'service', content: '# Service' };
      dossierRepo.findPage.mockResolvedValue(dossierPage);

      const anthropicClient = makeAnthropicClient([
        makeToolUseResponse([{ id: 'tu1', name: 'dossier_read', input: { repo_slug: 'backend-api', scope: 'web', slug: 'service' } }]),
        makeEndTurnResponse('BRIEF:\nThis is the answer.\nSOURCES: dossier/backend-api/web/service'),
      ]);

      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      const result = await impl.search('project-1', 'How does auth work?', 'test-key');

      expect(result.answer).toBe('This is the answer.');
      expect(result.sources).toEqual(['dossier/backend-api/web/service']);
      expect(result.promptRevisionId).toBe('prompt-rev-1');
    });
  });

  describe('multi-hop traversal', () => {
    it('compendium_read → list_scopes → dossier_read_pages → end_turn', async () => {
      const compendiumRepo = makeCompendiumRepo();
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      compendiumRepo.findBySlug.mockResolvedValue({ slug: 'transport-graph', content: '# Transport Graph' });
      dossierRepo.listScopes.mockResolvedValue([{ scope: 'web', pageCount: 4 }]);
      dossierRepo.findPages.mockResolvedValue([
        { repoSlug: 'backend-api', scope: 'web', slug: 'service', content: '# Service content' },
      ]);

      const anthropicClient = makeAnthropicClient([
        makeToolUseResponse([{ id: 'tu1', name: 'compendium_read', input: { slug: 'transport-graph' } }]),
        makeToolUseResponse([{ id: 'tu2', name: 'list_scopes', input: { repo_slug: 'backend-api' } }]),
        makeToolUseResponse([{
          id: 'tu3',
          name: 'dossier_read_pages',
          input: { refs: [{ repo_slug: 'backend-api', scope: 'web', slug: 'service' }] },
        }]),
        makeEndTurnResponse('BRIEF:\nFinal answer.\nSOURCES: compendium/transport-graph, dossier/backend-api/web/service'),
      ]);

      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      const result = await impl.search('project-1', 'How does transport work?', 'test-key');

      expect(result.sources).toContain('compendium/transport-graph');
      expect(result.sources).toContain('dossier/backend-api/web/service');
      expect(dossierRepo.listScopes).toHaveBeenCalledWith('project-1', 'backend-api');
    });
  });

  describe('no-index error', () => {
    it('throws when compendium index is missing and makes no Anthropic call', async () => {
      const compendiumRepo = makeCompendiumRepo(null);
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      const anthropicClient = makeAnthropicClient([]);
      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      await expect(impl.search('project-1', 'question', 'key')).rejects.toThrow(/compendium index/i);
      expect(anthropicClient.messages.create).not.toHaveBeenCalled();
    });
  });

  describe('budget-exhaust finalization', () => {
    it('makes a final call with tool_choice: none when budget exhausted, returns stopReason=budget', async () => {
      const compendiumRepo = makeCompendiumRepo();
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      const budget = { maxIters: 1, maxPagesRead: 100, maxTotalTokens: 1_000_000 };

      // First call: tool_use (iter 1 = maxIters), should trigger budget finalization
      const anthropicClient = makeAnthropicClient([
        makeToolUseResponse([{ id: 'tu1', name: 'list_scopes', input: { repo_slug: 'backend-api' } }]),
        makeEndTurnResponse('BRIEF:\nPartial answer.\nSOURCES: '),
      ]);

      dossierRepo.listScopes.mockResolvedValue([]);

      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any, budget);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      const result = await impl.search('project-1', 'question', 'key');

      expect(result.metrics.stopReason).toBe('budget');

      // Check that the 2nd call used tool_choice: none
      const calls = anthropicClient.messages.create.mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[1][0].tool_choice).toEqual({ type: 'none' });
    });
  });

  describe('compendium_read index rejection', () => {
    it('returns error and does not count page read when model calls compendium_read(index)', async () => {
      const compendiumRepo = makeCompendiumRepo();
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      const anthropicClient = makeAnthropicClient([
        makeToolUseResponse([{ id: 'tu1', name: 'compendium_read', input: { slug: 'index' } }]),
        makeEndTurnResponse('BRIEF:\nAnswer.\nSOURCES: '),
      ]);

      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      const result = await impl.search('project-1', 'question', 'key');

      // Tool result should be the error (last user message in the 2nd call contains tool results)
      const toolResultCall = anthropicClient.messages.create.mock.calls[1][0];
      const userMessages = toolResultCall.messages.filter((m: any) => m.role === 'user');
      const toolResult = userMessages[userMessages.length - 1];
      const toolResultContent = toolResult.content[0];
      const payload = JSON.parse(toolResultContent.content);
      expect(payload.ok).toBe(false);
      expect(payload.error).toMatch(/bootstrap/i);

      // pagesRead should be 0
      expect(result.metrics.pagesRead).toBe(0);
    });
  });

  describe('dossier_read_pages batch limit', () => {
    it('returns error when refs count > 6', async () => {
      const compendiumRepo = makeCompendiumRepo();
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      const refs = Array.from({ length: 7 }, (_, i) => ({
        repo_slug: 'r', scope: 's', slug: `p${i}`,
      }));

      const anthropicClient = makeAnthropicClient([
        makeToolUseResponse([{ id: 'tu1', name: 'dossier_read_pages', input: { refs } }]),
        makeEndTurnResponse('BRIEF:\nAnswer.\nSOURCES: '),
      ]);

      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      await impl.search('project-1', 'question', 'key');

      const toolResultCall = anthropicClient.messages.create.mock.calls[1][0];
      const userMessages = toolResultCall.messages.filter((m: any) => m.role === 'user');
      const toolResult = userMessages[userMessages.length - 1];
      const payload = JSON.parse(toolResult.content[0].content);
      expect(payload.ok).toBe(false);
      expect(payload.error).toMatch(/at most 6/i);
    });
  });

  describe('missing dossier page', () => {
    it('returns error when dossier_read returns null', async () => {
      const compendiumRepo = makeCompendiumRepo();
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      dossierRepo.findPage.mockResolvedValue(null);

      const anthropicClient = makeAnthropicClient([
        makeToolUseResponse([{ id: 'tu1', name: 'dossier_read', input: { repo_slug: 'unknown', scope: 'x', slug: 'service' } }]),
        makeEndTurnResponse('BRIEF:\nAnswer.\nSOURCES: '),
      ]);

      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      await impl.search('project-1', 'question', 'key');

      const toolResultCall = anthropicClient.messages.create.mock.calls[1][0];
      const userMessages = toolResultCall.messages.filter((m: any) => m.role === 'user');
      const toolResult = userMessages[userMessages.length - 1];
      const payload = JSON.parse(toolResult.content[0].content);
      expect(payload.ok).toBe(false);
      expect(payload.error).toMatch(/not found: dossier\/unknown\/x\/service/);
    });
  });

  describe('no SOURCES line fallback', () => {
    it('uses loop read-set when no SOURCES line', async () => {
      const compendiumRepo = makeCompendiumRepo();
      const dossierRepo = makeDossierRepo();
      const promptRepo = makePromptRepo();

      compendiumRepo.findBySlug.mockResolvedValue({ slug: 'system', content: '# System' });

      const anthropicClient = makeAnthropicClient([
        makeToolUseResponse([{ id: 'tu1', name: 'compendium_read', input: { slug: 'system' } }]),
        makeEndTurnResponse('BRIEF:\nAnswer without sources.'),
      ]);

      const impl = new SearchImplV2(compendiumRepo as any, dossierRepo as any, promptRepo as any);
      (impl as any).createAnthropicClient = jest.fn().mockReturnValue(anthropicClient);

      const result = await impl.search('project-1', 'question', 'key');

      // Should fall back to read-set
      expect(result.sources).toContain('compendium/system');
    });
  });
});
