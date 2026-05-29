import { SearchImpl, parseFinalAnswer } from '../../../shared/src/search/search.impl';
import {
  WikiRepository,
  WikiPage,
  WikiPageMeta,
  extractOneLiner,
} from '../../../shared/src/wiki-repository.interface';
import { WikiPageData } from '../../../shared/src/wiki-page.types';

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

function responseEndTurn(text: string) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

function responseToolUse(toolName: string, input: unknown, id = 'tu_1') {
  return {
    content: [{ type: 'tool_use', id, name: toolName, input }],
    stop_reason: 'tool_use',
    usage: { input_tokens: 200, output_tokens: 100 },
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
  it('extracts SOURCES line and strips it from answer', () => {
    const result = parseFinalAnswer('Answer body.\n\nSOURCES: a, b/c');
    expect(result.hadSourcesLine).toBe(true);
    expect(result.sources).toEqual(['a', 'b/c']);
    expect(result.answer).toBe('Answer body.');
  });

  it('marks missing SOURCES line', () => {
    const result = parseFinalAnswer('Just an answer.');
    expect(result.hadSourcesLine).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe('Just an answer.');
  });

  it('handles trailing blank lines around SOURCES', () => {
    const result = parseFinalAnswer('Body.\n\nSOURCES: x\n\n');
    expect(result.hadSourcesLine).toBe(true);
    expect(result.sources).toEqual(['x']);
    expect(result.answer).toBe('Body.');
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
    const impl = new SearchImpl(repo);
    await expect(impl.search('p1', 'q', 'key')).rejects.toThrow(/No wiki pages found/);
    expect(recordedCalls).toEqual([]);
  });

  it('handles single read_page → end_turn and strips SOURCES line', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'apps/a', category: 'apps', title: 'A', content: '# A\n\ndetail of A' }),
    ]);
    queueResponse(responseToolUse('read_page', { slug: 'apps/a' }));
    queueResponse(responseEndTurn('Answer about A.\n\nSOURCES: apps/a'));

    const impl = new SearchImpl(repo);
    const { answer, sources } = await impl.search('p1', 'how does A work?', 'key');
    expect(answer).toBe('Answer about A.');
    expect(sources).toEqual(['apps/a']);
    expect(recordedCalls.length).toBe(2);

    const first = recordedCalls[0];
    expect(first.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(first.messages[0].content[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(first.messages[1].content[0].cache_control).toBeUndefined();
    expect(first.tools.map((t: any) => t.name)).toEqual([
      'list_categories',
      'list_in',
      'page_meta',
      'read_page',
      'read_pages',
      'read_related',
    ]);
  });

  it('falls back to slugs read during the loop when SOURCES line missing', async () => {
    const repo = new MemoryRepo([
      indexPage(),
      makePage({ slug: 'apps/a', category: 'apps' }),
      makePage({ slug: 'apps/b', category: 'apps' }),
    ]);
    queueResponse(responseToolUse('read_pages', { slugs: ['apps/a', 'apps/b'] }));
    queueResponse(responseEndTurn('Answer without sources line.'));

    const impl = new SearchImpl(repo);
    const { answer, sources } = await impl.search('p1', 'q', 'key');
    expect(answer).toBe('Answer without sources line.');
    expect(sources.sort()).toEqual(['apps/a', 'apps/b']);
  });

  it('rejects read_pages with more than 6 slugs via tool_result error', async () => {
    const pages = [indexPage(), ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => makePage({ slug: s, category: 'x' }))];
    const repo = new MemoryRepo(pages);
    queueResponse(responseToolUse('read_pages', { slugs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
    queueResponse(responseEndTurn('Done.\nSOURCES: '));

    const impl = new SearchImpl(repo);
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
    queueResponse(responseEndTurn('Nothing.\nSOURCES:'));

    const impl = new SearchImpl(repo);
    await impl.search('p1', 'q', 'key');

    const tr = lastToolResult(recordedCalls[1]);
    const payload = JSON.parse(tr.content);
    expect(payload).toEqual({ ok: false, error: 'page not found: nope' });
  });

  it('forces a partial finalization when maxIters is reached', async () => {
    const repo = new MemoryRepo([indexPage(), makePage({ slug: 'a', category: 'x' })]);
    queueResponse(responseToolUse('read_page', { slug: 'a' }, 'tu_0'));
    queueResponse(responseToolUse('read_page', { slug: 'a' }, 'tu_1'));
    queueResponse(responseEndTurn('Partial.\nSOURCES: a'));

    const impl = new SearchImpl(repo, { maxIters: 2, maxPagesRead: 99, maxTotalTokens: 999_999 });
    const { answer, sources } = await impl.search('p1', 'q', 'key');
    expect(answer).toBe('Partial.');
    expect(sources).toEqual(['a']);
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
    queueResponse(responseEndTurn('Done.\nSOURCES: a'));

    const impl = new SearchImpl(repo, { maxIters: 99, maxPagesRead: 1, maxTotalTokens: 999_999 });
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
    queueResponse(responseEndTurn('Partial.\nSOURCES: a'));

    const impl = new SearchImpl(repo, { maxIters: 99, maxPagesRead: 99, maxTotalTokens: 10_000 });
    const { answer, sources } = await impl.search('p1', 'q', 'key');
    expect(answer).toBe('Partial.');
    expect(sources).toEqual(['a']);
    expect(recordedCalls.length).toBe(2);
    expect(recordedCalls[1].tool_choice).toEqual({ type: 'none' });
  });

  it('handles stop_reason max_tokens by synthesizing tool_results and finalizing', async () => {
    const repo = new MemoryRepo([indexPage()]);
    queueResponse({
      content: [{ type: 'tool_use', id: 'tu1', name: 'read_page', input: { slug: 'a' } }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 100, output_tokens: 4096 },
    });
    queueResponse(responseEndTurn('Done.\nSOURCES: index'));

    const impl = new SearchImpl(repo);
    const { answer, sources } = await impl.search('p1', 'q', 'key');
    expect(answer).toBe('Done.');
    expect(sources).toEqual(['index']);

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
    queueResponse(responseEndTurn('Done.\nSOURCES: apps/a'));

    const impl = new SearchImpl(repo);
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
    queueResponse(responseEndTurn('Done.\nSOURCES: a, b, c'));

    const impl = new SearchImpl(repo);
    const { sources } = await impl.search('p1', 'q', 'key');
    expect(sources.sort()).toEqual(['a', 'b', 'c']);
    const tr = JSON.parse(lastToolResult(recordedCalls[1]).content);
    expect(tr.pages.map((p: any) => p.slug).sort()).toEqual(['b', 'c']);
  });
});
