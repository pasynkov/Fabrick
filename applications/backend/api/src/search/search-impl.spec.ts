import { SearchImpl, parseFinalAnswer } from '../../../shared/src/search/search.impl';
import {
  WikiRepository,
  WikiPage,
  WikiPageMeta,
  extractOneLiner,
} from '../../../shared/src/wiki-repository.interface';
import { WikiPageData } from '../../../shared/src/wiki-page.types';
import { PromptRepository, PromptRecord } from '../../../shared/src/prompt-repository.interface';

const createMock = jest.fn();
const recordedCalls: any[] = [];
const pendingResponses: any[] = [];

function queueResponse(resp: any): void {
  pendingResponses.push(resp);
}

createMock.mockImplementation(async (req: any) => {
  recordedCalls.push(structuredClone(req));
  if (pendingResponses.length === 0) throw new Error('no queued response for create()');
  return pendingResponses.shift();
});

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
  };
});

const MOCK_PROMPT_RECORD: PromptRecord = {
  id: 'prompt-rev-id-1',
  name: 'search',
  agent: 'claude',
  revision: 1,
  content: {
    files: {
      'prompt.md': 'You are a search agent over a project wiki.',
    },
  },
};

class MockPromptRepo implements PromptRepository {
  private readonly record: PromptRecord;
  readonly calls: Array<{ name: string; agent: string }> = [];

  constructor(record: PromptRecord = MOCK_PROMPT_RECORD) {
    this.record = record;
  }

  async getLatest(name: string, agent: string): Promise<PromptRecord> {
    this.calls.push({ name, agent });
    return this.record;
  }
}

class MemoryRepo implements WikiRepository {
  constructor(private readonly pages: WikiPage[]) {}
  async findBySlug(_projectId: string, slug: string): Promise<WikiPage | null> {
    return this.pages.find((p) => p.slug === slug) ?? null;
  }
  async findBySlugs(_projectId: string, slugs: string[]): Promise<WikiPage[]> {
    return this.pages.filter((p) => slugs.includes(p.slug));
  }
  async findByProject(_projectId: string): Promise<WikiPage[]> {
    return this.pages;
  }
  async findCategories(_projectId: string): Promise<string[]> {
    return Array.from(new Set(this.pages.map((p) => p.category)));
  }
  async findByCategory(_projectId: string, category: string): Promise<WikiPageMeta[]> {
    return this.pages
      .filter((p) => p.category === category)
      .map((p) => ({ slug: p.slug, title: p.title, one_liner: extractOneLiner(p.content) }));
  }
  async upsert(_projectId: string, _pages: WikiPageData[]): Promise<void> {}
  async delete(_projectId: string, _slugs: string[]): Promise<void> {}
}

function makePage(over: Partial<WikiPage>): WikiPage {
  return {
    slug: over.slug ?? 'x',
    category: over.category ?? 'overview',
    title: over.title ?? 'X',
    content: over.content ?? '# X\n\nbody.',
    sources: over.sources ?? [],
    related: over.related ?? [],
  };
}

function responseEndTurn(text: string, usage?: { input_tokens: number; output_tokens: number }) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: usage ?? { input_tokens: 100, output_tokens: 50 },
  };
}

function responseToolUse(toolName: string, input: unknown, id = 'tu_1', usage?: { input_tokens: number; output_tokens: number }) {
  return {
    content: [{ type: 'tool_use', id, name: toolName, input }],
    stop_reason: 'tool_use',
    usage: usage ?? { input_tokens: 200, output_tokens: 100 },
  };
}

function lastToolResult(call: any): any {
  const msg = call.messages[call.messages.length - 1];
  return msg.content[0];
}

beforeEach(() => {
  recordedCalls.length = 0;
  pendingResponses.length = 0;
});

describe('parseFinalAnswer', () => {
  it('extracts BRIEF and SOURCES lines without REASONING', () => {
    const result = parseFinalAnswer('BRIEF:\nAnswer body.\n\nSOURCES: a, b/c');
    expect(result.hadBriefMarker).toBe(true);
    expect(result.hadSourcesLine).toBe(true);
    expect(result.sources).toEqual(['a', 'b/c']);
    expect(result.answer).toBe('Answer body.');
    expect(result.reasoning).toBeUndefined();
  });

  it('extracts BRIEF, REASONING and SOURCES sections', () => {
    const text = [
      'BRIEF:',
      'Concise answer.',
      '',
      'REASONING:',
      'Long explanation line 1.',
      'Long explanation line 2.',
      '',
      'SOURCES: a, b',
    ].join('\n');
    const result = parseFinalAnswer(text);
    expect(result.hadBriefMarker).toBe(true);
    expect(result.hadSourcesLine).toBe(true);
    expect(result.answer).toBe('Concise answer.');
    expect(result.reasoning).toBe('Long explanation line 1.\nLong explanation line 2.');
    expect(result.sources).toEqual(['a', 'b']);
  });

  it('returns full text when BRIEF marker missing but SOURCES present', () => {
    const result = parseFinalAnswer('Just a plain answer.\n\nSOURCES: x');
    expect(result.hadBriefMarker).toBe(false);
    expect(result.hadSourcesLine).toBe(true);
    expect(result.sources).toEqual(['x']);
    expect(result.answer).toBe('Just a plain answer.');
    expect(result.reasoning).toBeUndefined();
  });

  it('marks missing SOURCES line', () => {
    const result = parseFinalAnswer('Just an answer.');
    expect(result.hadSourcesLine).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe('Just an answer.');
  });
});

describe('extractOneLiner', () => {
  it('returns first paragraph after a heading', () => {
    expect(extractOneLiner('# Title\n\nFirst line.\n\nSecond.')).toBe('First line.');
  });

  it('returns the first non-empty line when no heading', () => {
    expect(extractOneLiner('\n\nBody only.')).toBe('Body only.');
  });

  it('returns empty string for empty content', () => {
    expect(extractOneLiner('')).toBe('');
  });
});

describe('SearchImpl agentic loop', () => {
  function indexPage(): WikiPage {
    return makePage({ slug: 'index', category: 'index', title: 'Index', content: '# Index\n\nLinks: a, b.' });
  }

  it('throws when index page is missing and does not call Anthropic', async () => {
    const repo = new MemoryRepo([]);
    const impl = new SearchImpl(repo, new MockPromptRepo());
    await expect(impl.search('p1', 'q', 'key')).rejects.toThrow(/No wiki pages found/);
    expect(recordedCalls).toEqual([]);
  });

  it('reasoning=false returns brief answer with no reasoning field and forwards reasoning=false to prompt', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'apps/a', category: 'apps', title: 'A', content: '# A\n\ndetail of A' }),
    ]);
    queueResponse(responseToolUse('read_page', { slug: 'apps/a' }));
    queueResponse(responseEndTurn('BRIEF:\nA is the answer.\n\nSOURCES: apps/a'));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    const result = await impl.search('p1', 'how does A work?', 'key');
    expect(result.answer).toBe('A is the answer.');
    expect(result.reasoning).toBeUndefined();
    expect(result.sources).toEqual(['apps/a']);
    expect(result.metrics.iters).toBe(2);
    expect(result.metrics.stopReason).toBe('end_turn');
    expect(result.metrics.perCallTokens).toEqual([
      { inputTokens: 200, outputTokens: 100 },
      { inputTokens: 100, outputTokens: 50 },
    ]);
    expect(result.metrics.totalInputTokens).toBe(300);
    expect(result.metrics.totalOutputTokens).toBe(150);
    expect(typeof result.metrics.durationMs).toBe('number');
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);

    const first = recordedCalls[0];
    // Reasoning hint message should be present
    const reasoningHint = first.messages.find((m: any) => m.content?.[0]?.text?.startsWith('Reasoning requested:'));
    expect(reasoningHint).toBeDefined();
    expect(reasoningHint.content[0].text).toBe('Reasoning requested: false');
    expect(first.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(first.tools.map((t: any) => t.name)).toEqual([
      'list_categories',
      'list_in',
      'page_meta',
      'read_page',
      'read_pages',
      'read_related',
    ]);
  });

  it('reasoning=true returns both answer and reasoning text and forwards reasoning=true to prompt', async () => {
    const repo = new MemoryRepo([indexPage(), makePage({ slug: 'apps/a', category: 'apps' })]);
    const text = [
      'BRIEF:',
      'Short answer.',
      '',
      'REASONING:',
      'Long detailed reasoning.',
      '',
      'SOURCES: apps/a',
    ].join('\n');
    queueResponse(responseEndTurn(text));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    const result = await impl.search('p1', 'q', 'key', { reasoning: true });
    expect(result.answer).toBe('Short answer.');
    expect(result.reasoning).toBe('Long detailed reasoning.');
    expect(result.sources).toEqual(['apps/a']);

    const first = recordedCalls[0];
    const reasoningHint = first.messages.find((m: any) => m.content?.[0]?.text?.startsWith('Reasoning requested:'));
    expect(reasoningHint.content[0].text).toBe('Reasoning requested: true');
  });

  it('falls back to full text as answer when BRIEF marker missing', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'apps/a', category: 'apps' }),
      makePage({ slug: 'apps/b', category: 'apps' }),
    ]);
    queueResponse(responseToolUse('read_pages', { slugs: ['apps/a', 'apps/b'] }));
    queueResponse(responseEndTurn('Answer without brief marker.\nSOURCES: apps/a, apps/b'));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    const result = await impl.search('p1', 'q', 'key');
    expect(result.answer).toBe('Answer without brief marker.');
    expect(result.reasoning).toBeUndefined();
    expect(result.sources.sort()).toEqual(['apps/a', 'apps/b']);
  });

  it('falls back to slugs read during the loop when SOURCES line missing', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'apps/a', category: 'apps' }),
      makePage({ slug: 'apps/b', category: 'apps' }),
    ]);
    queueResponse(responseToolUse('read_pages', { slugs: ['apps/a', 'apps/b'] }));
    queueResponse(responseEndTurn('BRIEF:\nNo sources line here.'));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    const { answer, sources } = await impl.search('p1', 'q', 'key');
    expect(answer).toBe('No sources line here.');
    expect(sources.sort()).toEqual(['apps/a', 'apps/b']);
  });

  it('rejects read_pages with more than 6 slugs via tool_result error', async () => {
    const pages = [indexPage(), ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => makePage({ slug: s, category: 'x' }))];
    const repo = new MemoryRepo(pages);
    queueResponse(responseToolUse('read_pages', { slugs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
    queueResponse(responseEndTurn('BRIEF:\nDone.\nSOURCES: '));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    await impl.search('p1', 'q', 'key');

    const tr = lastToolResult(recordedCalls[1]);
    expect(tr.type).toBe('tool_result');
    const payload = JSON.parse(tr.content);
    expect(payload.ok).toBe(false);
    expect(payload.error).toMatch(/at most 6/);
  });

  it('returns page not found for unknown slug in read_page', async () => {
    const repo = new MemoryRepo([indexPage()]);
    queueResponse(responseToolUse('read_page', { slug: 'nope' }));
    queueResponse(responseEndTurn('BRIEF:\nNothing.\nSOURCES:'));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    await impl.search('p1', 'q', 'key');

    const tr = lastToolResult(recordedCalls[1]);
    const payload = JSON.parse(tr.content);
    expect(payload).toEqual({ ok: false, error: 'page not found: nope' });
  });

  it('forces a partial finalization when maxIters is reached and reports stopReason=budget', async () => {
    const repo = new MemoryRepo([indexPage(), makePage({ slug: 'a', category: 'x' })]);
    queueResponse(responseToolUse('read_page', { slug: 'a' }, 'tu_0'));
    queueResponse(responseToolUse('read_page', { slug: 'a' }, 'tu_1'));
    queueResponse(responseEndTurn('BRIEF:\nPartial.\nSOURCES: a'));

    const impl = new SearchImpl(repo, new MockPromptRepo(), { maxIters: 2, maxPagesRead: 99, maxTotalTokens: 999_999 });
    const result = await impl.search('p1', 'q', 'key');
    expect(result.answer).toBe('Partial.');
    expect(result.sources).toEqual(['a']);
    expect(result.metrics.stopReason).toBe('budget');
    expect(recordedCalls.length).toBe(3);

    const finalCall = recordedCalls[2];
    expect(finalCall.tool_choice).toEqual({ type: 'none' });
    const lastUserMsg = finalCall.messages[finalCall.messages.length - 1];
    expect(lastUserMsg.role).toBe('user');
    expect(lastUserMsg.content[0].text).toMatch(/Budget exhausted/i);
  });

  it('blocks content-tool calls once maxPagesRead is reached but lets metadata tools through', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'a', category: 'x' }),
      makePage({ slug: 'b', category: 'x' }),
    ]);
    queueResponse(responseToolUse('read_page', { slug: 'a' }, 'tu1'));
    queueResponse(responseToolUse('read_page', { slug: 'b' }, 'tu2'));
    queueResponse(responseToolUse('list_categories', {}, 'tu3'));
    queueResponse(responseEndTurn('BRIEF:\nDone.\nSOURCES: a'));

    const impl = new SearchImpl(repo, new MockPromptRepo(), { maxIters: 99, maxPagesRead: 1, maxTotalTokens: 999_999 });
    await impl.search('p1', 'q', 'key');

    const blockedTr = lastToolResult(recordedCalls[2]);
    expect(JSON.parse(blockedTr.content).error).toMatch(/page-read budget/);
    const metaTr = lastToolResult(recordedCalls[3]);
    expect(JSON.parse(metaTr.content).ok).toBe(true);
  });

  it('triggers partial finalization when maxTotalTokens is reached', async () => {
    const repo = new MemoryRepo([indexPage(), makePage({ slug: 'a', category: 'x' })]);
    queueResponse({
      content: [{ type: 'tool_use', id: 'tu1', name: 'read_page', input: { slug: 'a' } }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 9000, output_tokens: 9000 },
    });
    queueResponse(responseEndTurn('BRIEF:\nPartial.\nSOURCES: a'));

    const impl = new SearchImpl(repo, new MockPromptRepo(), { maxIters: 99, maxPagesRead: 99, maxTotalTokens: 10_000 });
    const result = await impl.search('p1', 'q', 'key');
    expect(result.answer).toBe('Partial.');
    expect(result.sources).toEqual(['a']);
    expect(result.metrics.stopReason).toBe('budget');
    expect(recordedCalls.length).toBe(2);
    expect(recordedCalls[1].tool_choice).toEqual({ type: 'none' });
  });

  it('handles stop_reason max_tokens by synthesizing tool_results and finalizing with stopReason=max_tokens', async () => {
    const repo = new MemoryRepo([indexPage()]);
    queueResponse({
      content: [{ type: 'tool_use', id: 'tu1', name: 'read_page', input: { slug: 'a' } }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 100, output_tokens: 4096 },
    });
    queueResponse(responseEndTurn('BRIEF:\nDone.\nSOURCES: index'));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    const result = await impl.search('p1', 'q', 'key');
    expect(result.answer).toBe('Done.');
    expect(result.sources).toEqual(['index']);
    expect(result.metrics.stopReason).toBe('max_tokens');

    const finalCall = recordedCalls[1];
    expect(finalCall.tool_choice).toEqual({ type: 'none' });
    const synthesizedToolResult = finalCall.messages[finalCall.messages.length - 2].content[0];
    expect(synthesizedToolResult.type).toBe('tool_result');
    expect(synthesizedToolResult.is_error).toBe(true);
  });

  it('dispatches list_in / list_categories against repository projections', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'apps/a', category: 'apps', title: 'A', content: '# A\n\nfirst line of A.' }),
      makePage({ slug: 'apps/b', category: 'apps', title: 'B', content: '# B\n\nfirst line of B.' }),
      makePage({ slug: 'entities/x', category: 'entities', title: 'X', content: '# X\n\nx line.' }),
    ]);
    queueResponse(responseToolUse('list_categories', {}, 'tu1'));
    queueResponse(responseToolUse('list_in', { category: 'apps' }, 'tu2'));
    queueResponse(responseEndTurn('BRIEF:\nDone.\nSOURCES: apps/a'));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    await impl.search('p1', 'q', 'key');

    const categoriesPayload = JSON.parse(lastToolResult(recordedCalls[1]).content);
    expect(categoriesPayload.categories.sort()).toEqual(['apps', 'entities', 'index']);
    const listInPayload = JSON.parse(lastToolResult(recordedCalls[2]).content);
    expect(listInPayload.pages).toEqual([
      { slug: 'apps/a', title: 'A', one_liner: 'first line of A.' },
      { slug: 'apps/b', title: 'B', one_liner: 'first line of B.' },
    ]);
  });

  it('read_related traverses the related[] graph up to depth', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'a', category: 'x', related: ['b', 'c'] }),
      makePage({ slug: 'b', category: 'x' }),
      makePage({ slug: 'c', category: 'x' }),
    ]);
    queueResponse(responseToolUse('read_related', { slug: 'a', depth: 1 }, 'tu1'));
    queueResponse(responseEndTurn('BRIEF:\nDone.\nSOURCES: a, b, c'));

    const impl = new SearchImpl(repo, new MockPromptRepo());
    const { sources } = await impl.search('p1', 'q', 'key');
    expect(sources.sort()).toEqual(['a', 'b', 'c']);
    const tr = JSON.parse(lastToolResult(recordedCalls[1]).content);
    expect(tr.pages.map((p: any) => p.slug).sort()).toEqual(['b', 'c']);
  });

  it('calls getLatest once per search() and propagates promptRevisionId', async () => {
    const repo = new MemoryRepo([indexPage()]);
    const promptRepo = new MockPromptRepo();
    queueResponse(responseEndTurn('BRIEF:\nDone.\nSOURCES: index'));

    const impl = new SearchImpl(repo, promptRepo);
    const result = await impl.search('p1', 'q', 'key');

    expect(promptRepo.calls).toHaveLength(1);
    expect(promptRepo.calls[0]).toEqual({ name: 'search', agent: 'claude' });
    expect(result.promptRevisionId).toBe(MOCK_PROMPT_RECORD.id);
  });

  it('bubbles up getLatest rejection unchanged', async () => {
    const repo = new MemoryRepo([indexPage()]);
    const failingPromptRepo: PromptRepository = {
      async getLatest(name: string, agent: string): Promise<PromptRecord> {
        throw new Error(`Prompt not found: (${name}, ${agent})`);
      },
    };

    const impl = new SearchImpl(repo, failingPromptRepo);
    await expect(impl.search('p1', 'q', 'key')).rejects.toThrow(/Prompt not found: \(search, claude\)/);
  });
});
