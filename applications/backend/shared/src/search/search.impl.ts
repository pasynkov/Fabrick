import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages/messages';
import { WIKI_REPOSITORY, WikiRepository } from '../wiki-repository.interface';

export interface SearchBudget {
  maxIters: number;
  maxPagesRead: number;
  maxTotalTokens: number;
}

const DEFAULT_BUDGET: SearchBudget = {
  maxIters: Number(process.env.FABRICK_SEARCH_MAX_ITERS) || 8,
  maxPagesRead: Number(process.env.FABRICK_SEARCH_MAX_PAGES_READ) || 12,
  maxTotalTokens: Number(process.env.FABRICK_SEARCH_MAX_TOTAL_TOKENS) || 50_000,
};

const MAX_READ_PAGES_BATCH = 6;
const SEARCH_MODEL = 'claude-sonnet-4-6';
const PER_CALL_MAX_TOKENS = 4096;

export type StopReason = 'end_turn' | 'budget' | 'max_tokens' | 'other';

export interface SearchMetrics {
  iters: number;
  pagesRead: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  stopReason: StopReason;
  perCallTokens: Array<{ inputTokens: number; outputTokens: number }>;
}

export interface SearchResult {
  answer: string;
  reasoning?: string;
  sources: string[];
  metrics: SearchMetrics;
}

const SYSTEM_PROMPT = `You are a search agent over a project wiki. The wiki is a curated set of markdown pages organized by category. The project's index page is provided as context.

You can call these tools to explore the wiki:
- list_categories(): list every category in the project.
- list_in(category): list pages in a category as { slug, title, one_liner }.
- page_meta(slug): metadata about a page, including its related[] and sources[] links.
- read_page(slug): full content of one page.
- read_pages(slugs[]): batched content read, at most ${MAX_READ_PAGES_BATCH} slugs per call.
- read_related(slug, depth=1): the related neighborhood of a page, full content.

Strategy hints (not rigid):
- The index is already in context; pick likely entry pages from it before calling tools.
- Prefer reading 1-3 candidate pages first; widen via read_related only if needed.
- Stop calling tools as soon as you have enough context to answer concretely.
- Be parsimonious — do not over-fetch.

Final answer format:
- A single concise paragraph answering the question, prefixed by a line containing only "BRIEF:".
- If reasoning was requested by the caller, follow with a line containing only "REASONING:", then a detailed explanation.
- The very last line MUST be: SOURCES: <slug>, <slug>, ...
  using only the slugs whose content you actually used.

Worked examples:

Example 1 — direct page hit (reasoning not requested):
  Q: "Where do trades land in BigQuery?"
  -> read_page("apps/harvester-reaper")
  -> Answer:
       BRIEF:
       Trades land in the trades table.
       SOURCES: apps/harvester-reaper

Example 2 — multi-hop via read_related (reasoning requested):
  Q: "How does the reaper get triggered?"
  -> read_page("apps/harvester-reaper")
  -> read_related("apps/harvester-reaper", depth=1)
  -> Answer:
       BRIEF:
       The reaper is triggered by the conductor.
       REASONING:
       Details about scheduling, NATS subjects, and conductor handoff.
       SOURCES: apps/harvester-reaper, apps/harvester-conductor
`;

const TOOL_DEFS: Tool[] = [
  {
    name: 'list_categories',
    description: 'List distinct categories present in the project wiki.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_in',
    description: 'List pages within a category as { slug, title, one_liner }. Use this to scan an area without reading full content.',
    input_schema: {
      type: 'object',
      properties: { category: { type: 'string' } },
      required: ['category'],
    },
  },
  {
    name: 'page_meta',
    description: 'Return metadata for a single page: title, category, related[], sources[], and size (chars).',
    input_schema: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
    },
  },
  {
    name: 'read_page',
    description: 'Read the full markdown content of one page.',
    input_schema: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
    },
  },
  {
    name: 'read_pages',
    description: `Read the full content of multiple pages in one call. Maximum ${MAX_READ_PAGES_BATCH} slugs per call.`,
    input_schema: {
      type: 'object',
      properties: { slugs: { type: 'array', items: { type: 'string' } } },
      required: ['slugs'],
    },
  },
  {
    name: 'read_related',
    description: 'Read the full content of pages directly linked from this page via its related[] list. depth=1 (default) reads immediate neighbors; depth=2 also reads their immediate neighbors.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        depth: { type: 'integer', enum: [1, 2], default: 1 },
      },
      required: ['slug'],
    },
  },
];

interface LoopState {
  iter: number;
  pagesRead: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  readSlugs: Set<string>;
  perCallTokens: Array<{ inputTokens: number; outputTokens: number }>;
}

interface ToolDispatchResult {
  payload: unknown;
  pageReadCount: number;
  slugsRead: string[];
}

@Injectable()
export class SearchImpl {
  private readonly logger = new Logger(SearchImpl.name);

  private readonly budget: SearchBudget;

  constructor(
    @Inject(WIKI_REPOSITORY) private readonly wikiRepo: WikiRepository,
    @Optional() budget?: SearchBudget,
  ) {
    this.budget = budget ?? DEFAULT_BUDGET;
  }

  async search(
    projectId: string,
    question: string,
    apiKey: string,
    opts?: { reasoning?: boolean },
  ): Promise<SearchResult> {
    const reasoning = opts?.reasoning === true;
    const t0 = Date.now();
    this.logger.log(`search started  projectId=${projectId}  reasoning=${reasoning}  q="${question.slice(0, 80)}"`);

    const indexPage = await this.wikiRepo.findBySlug(projectId, 'index');
    if (!indexPage) {
      throw new Error('No wiki pages found. Run synthesis first.');
    }

    const anthropic = new Anthropic({ apiKey });
    const system: TextBlockParam[] = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ];
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Project wiki index:\n\n${indexPage.content}`,
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: `Reasoning requested: ${reasoning ? 'true' : 'false'}` }] },
      { role: 'user', content: [{ type: 'text', text: `Question: ${question}` }] },
    ];

    const state: LoopState = {
      iter: 0,
      pagesRead: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      readSlugs: new Set(),
      perCallTokens: [],
    };
    let finalText: string | null = null;
    let stopReason: StopReason = 'other';

    while (true) {
      state.iter += 1;
      const response = await anthropic.messages.create({
        model: SEARCH_MODEL,
        max_tokens: PER_CALL_MAX_TOKENS,
        system,
        tools: TOOL_DEFS,
        messages,
      });
      this.recordUsage(response, state);

      if (response.stop_reason === 'end_turn') {
        finalText = extractText(response.content);
        stopReason = 'end_turn';
        break;
      }

      if (response.stop_reason === 'tool_use') {
        await this.handleToolUseTurn(projectId, response, messages, state);
        if (
          state.iter >= this.budget.maxIters ||
          state.totalInputTokens + state.totalOutputTokens >= this.budget.maxTotalTokens
        ) {
          finalText = await this.finalizePartial(anthropic, system, messages, state, 'budget exhausted');
          stopReason = 'budget';
          break;
        }
        continue;
      }

      if (response.stop_reason === 'max_tokens') {
        await this.absorbAssistantTurn(response, messages);
        finalText = await this.finalizePartial(anthropic, system, messages, state, 'max_tokens during turn');
        stopReason = 'max_tokens';
        break;
      }

      finalText = extractText(response.content);
      stopReason = 'other';
      break;
    }

    const parsed = parseFinalAnswer(finalText ?? '');
    let sources = parsed.sources;
    if (!parsed.hadSourcesLine) {
      this.logger.warn(`final answer missing SOURCES: line; falling back to slugs read during loop`);
      sources = Array.from(state.readSlugs);
    }
    if (!parsed.hadBriefMarker) {
      this.logger.warn(`final answer missing BRIEF: marker; returning full text as answer`);
    }

    const durationMs = Date.now() - t0;
    this.logger.log(
      `search done  iters=${state.iter}  pagesRead=${state.pagesRead}  totalTokens=${state.totalInputTokens + state.totalOutputTokens}  sources=${sources.length}  stop=${stopReason}  duration=${durationMs}ms`,
    );

    const result: SearchResult = {
      answer: parsed.answer,
      sources,
      metrics: {
        iters: state.iter,
        pagesRead: state.pagesRead,
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens,
        durationMs,
        stopReason,
        perCallTokens: state.perCallTokens,
      },
    };
    if (parsed.reasoning !== undefined) {
      result.reasoning = parsed.reasoning;
    }
    return result;
  }

  private recordUsage(response: Message, state: LoopState): void {
    const usedIn = response.usage?.input_tokens ?? 0;
    const usedOut = response.usage?.output_tokens ?? 0;
    state.totalInputTokens += usedIn;
    state.totalOutputTokens += usedOut;
    state.perCallTokens.push({ inputTokens: usedIn, outputTokens: usedOut });
    this.logger.log(
      `iter ${state.iter}  stop=${response.stop_reason}  tokens(in=${usedIn} out=${usedOut} total=${state.totalInputTokens + state.totalOutputTokens})  pagesRead=${state.pagesRead}`,
    );
  }

  private async handleToolUseTurn(
    projectId: string,
    response: Message,
    messages: MessageParam[],
    state: LoopState,
  ): Promise<void> {
    const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    const toolResults: ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const result = await this.dispatchTool(projectId, tu, state);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result.payload),
      });
      state.pagesRead += result.pageReadCount;
      for (const s of result.slugsRead) state.readSlugs.add(s);
      this.logger.log(
        `  tool=${tu.name} args=${truncate(JSON.stringify(tu.input))} pagesAdded=${result.pageReadCount}`,
      );
    }
    messages.push({ role: 'assistant', content: toContentBlockParams(response.content) });
    messages.push({ role: 'user', content: toolResults });
  }

  private async absorbAssistantTurn(response: Message, messages: MessageParam[]): Promise<void> {
    const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    messages.push({ role: 'assistant', content: toContentBlockParams(response.content) });
    if (toolUses.length === 0) return;
    const toolResults: ToolResultBlockParam[] = toolUses.map((tu) => ({
      type: 'tool_result',
      tool_use_id: tu.id,
      content: JSON.stringify({ ok: false, error: 'aborted: max_tokens during turn' }),
      is_error: true,
    }));
    messages.push({ role: 'user', content: toolResults });
  }

  private async finalizePartial(
    anthropic: Anthropic,
    system: TextBlockParam[],
    messages: MessageParam[],
    state: LoopState,
    reason: string,
  ): Promise<string> {
    this.logger.warn(
      `partial finalization triggered  reason=${reason}  iter=${state.iter}  totalTokens=${state.totalInputTokens + state.totalOutputTokens}`,
    );
    const finalMessages: MessageParam[] = [
      ...messages,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Budget exhausted. Give a partial answer using only the pages you have already read. Use the same format: BRIEF: paragraph, optional REASONING: section, and end with a single SOURCES: <slug>, <slug>, ... line.',
          },
        ],
      },
    ];
    const response = await anthropic.messages.create({
      model: SEARCH_MODEL,
      max_tokens: PER_CALL_MAX_TOKENS,
      system,
      tools: TOOL_DEFS,
      tool_choice: { type: 'none' },
      messages: finalMessages,
    });
    this.recordUsage(response, state);
    return extractText(response.content) ?? '';
  }

  private async dispatchTool(
    projectId: string,
    tu: ToolUseBlock,
    state: LoopState,
  ): Promise<ToolDispatchResult> {
    const input = (tu.input ?? {}) as Record<string, unknown>;

    const isContentTool = tu.name === 'read_page' || tu.name === 'read_pages' || tu.name === 'read_related';
    if (isContentTool && state.pagesRead >= this.budget.maxPagesRead) {
      return errorResult(`page-read budget exhausted (max ${this.budget.maxPagesRead})`);
    }

    switch (tu.name) {
      case 'list_categories': {
        const categories = await this.wikiRepo.findCategories(projectId);
        return { payload: { ok: true, categories }, pageReadCount: 0, slugsRead: [] };
      }
      case 'list_in': {
        const category = String(input.category ?? '');
        if (!category) return errorResult('list_in requires a category');
        const pages = await this.wikiRepo.findByCategory(projectId, category);
        return { payload: { ok: true, pages }, pageReadCount: 0, slugsRead: [] };
      }
      case 'page_meta': {
        const slug = String(input.slug ?? '');
        if (!slug) return errorResult('page_meta requires a slug');
        const page = await this.wikiRepo.findBySlug(projectId, slug);
        if (!page) return errorResult(`page not found: ${slug}`);
        return {
          payload: {
            ok: true,
            title: page.title,
            category: page.category,
            related: page.related,
            sources: page.sources,
            size: page.content.length,
          },
          pageReadCount: 0,
          slugsRead: [],
        };
      }
      case 'read_page': {
        const slug = String(input.slug ?? '');
        if (!slug) return errorResult('read_page requires a slug');
        const page = await this.wikiRepo.findBySlug(projectId, slug);
        if (!page) return errorResult(`page not found: ${slug}`);
        return {
          payload: { ok: true, slug: page.slug, content: page.content },
          pageReadCount: 1,
          slugsRead: [page.slug],
        };
      }
      case 'read_pages': {
        const slugs = Array.isArray(input.slugs) ? (input.slugs as unknown[]).map(String) : [];
        if (slugs.length === 0) return errorResult('read_pages requires a non-empty slugs array');
        if (slugs.length > MAX_READ_PAGES_BATCH) {
          return errorResult(
            `read_pages accepts at most ${MAX_READ_PAGES_BATCH} slugs per call (got ${slugs.length})`,
          );
        }
        const pages = await this.wikiRepo.findBySlugs(projectId, slugs);
        const found = pages.map((p) => p.slug);
        const missing = slugs.filter((s) => !found.includes(s));
        return {
          payload: {
            ok: true,
            pages: pages.map((p) => ({ slug: p.slug, content: p.content })),
            missing,
          },
          pageReadCount: pages.length,
          slugsRead: found,
        };
      }
      case 'read_related': {
        const slug = String(input.slug ?? '');
        const depth = Number(input.depth ?? 1);
        if (!slug) return errorResult('read_related requires a slug');
        if (depth !== 1 && depth !== 2) return errorResult('read_related depth must be 1 or 2');
        const root = await this.wikiRepo.findBySlug(projectId, slug);
        if (!root) return errorResult(`page not found: ${slug}`);
        const visited = new Set<string>([slug]);
        let frontier = root.related.filter((s) => !visited.has(s));
        const collected: { slug: string; content: string }[] = [];
        for (let d = 1; d <= depth; d += 1) {
          if (frontier.length === 0) break;
          const remaining = Math.max(0, this.budget.maxPagesRead - (state.pagesRead + collected.length));
          if (remaining === 0) break;
          const slice = frontier.slice(0, remaining);
          const pages = await this.wikiRepo.findBySlugs(projectId, slice);
          const next: string[] = [];
          for (const p of pages) {
            if (visited.has(p.slug)) continue;
            visited.add(p.slug);
            collected.push({ slug: p.slug, content: p.content });
            for (const r of p.related) if (!visited.has(r)) next.push(r);
          }
          frontier = next;
        }
        return {
          payload: { ok: true, pages: collected },
          pageReadCount: collected.length,
          slugsRead: collected.map((p) => p.slug),
        };
      }
      default:
        return errorResult(`unknown tool: ${tu.name}`);
    }
  }
}

function errorResult(message: string): ToolDispatchResult {
  return { payload: { ok: false, error: message }, pageReadCount: 0, slugsRead: [] };
}

function extractText(content: ContentBlock[] | undefined): string | null {
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.length ? parts.join('\n').trim() : null;
}

function toContentBlockParams(content: ContentBlock[]): ContentBlockParam[] {
  return content.map((b) => {
    if (b.type === 'text') return { type: 'text', text: b.text };
    if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
    if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking, signature: b.signature };
    if (b.type === 'redacted_thinking') return { type: 'redacted_thinking', data: b.data };
    return { type: 'text', text: '' };
  });
}

export interface ParsedFinalAnswer {
  answer: string;
  reasoning?: string;
  sources: string[];
  hadBriefMarker: boolean;
  hadSourcesLine: boolean;
}

export function parseFinalAnswer(text: string): ParsedFinalAnswer {
  const lines = text.split(/\r?\n/);

  // Find SOURCES: line (scanning from the end for trailing whitespace tolerance).
  let sourcesIdx = -1;
  let sources: string[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(/^\s*SOURCES:\s*(.*)$/i);
    if (m) {
      sourcesIdx = i;
      sources = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      break;
    }
    if (lines[i].trim()) break;
  }

  const bodyEnd = sourcesIdx >= 0 ? sourcesIdx : lines.length;
  const bodyLines = lines.slice(0, bodyEnd);

  // Look for BRIEF: / REASONING: markers (case-sensitive on the marker).
  let briefIdx = -1;
  let reasoningIdx = -1;
  for (let i = 0; i < bodyLines.length; i += 1) {
    const stripped = bodyLines[i].trim();
    if (briefIdx === -1 && /^BRIEF:\s*$/.test(stripped)) {
      briefIdx = i;
      continue;
    }
    if (briefIdx !== -1 && reasoningIdx === -1 && /^REASONING:\s*$/.test(stripped)) {
      reasoningIdx = i;
    }
  }

  const hadSourcesLine = sourcesIdx >= 0;
  const hadBriefMarker = briefIdx >= 0;

  if (!hadBriefMarker) {
    // Fallback: full text minus the SOURCES line.
    const answer = bodyLines.join('\n').trim();
    return { answer, sources, hadBriefMarker, hadSourcesLine };
  }

  const briefStart = briefIdx + 1;
  const briefEnd = reasoningIdx === -1 ? bodyLines.length : reasoningIdx;
  const answer = bodyLines.slice(briefStart, briefEnd).join('\n').trim();

  let reasoning: string | undefined;
  if (reasoningIdx >= 0) {
    reasoning = bodyLines.slice(reasoningIdx + 1).join('\n').trim();
    if (reasoning.length === 0) reasoning = undefined;
  }

  const result: ParsedFinalAnswer = { answer, sources, hadBriefMarker, hadSourcesLine };
  if (reasoning !== undefined) result.reasoning = reasoning;
  return result;
}

function truncate(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
