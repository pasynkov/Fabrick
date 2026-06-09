import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages/messages';
import { COMPENDIUM_REPOSITORY, CompendiumRepository } from './compendium-repository.interface';
import { DOSSIER_REPOSITORY, DossierRepository } from './dossier-repository.interface';
import { PROMPT_REPOSITORY, PromptRepository } from '../prompt-repository.interface';
import { parseFinalAnswerV2 } from './parse-final-answer-v2';
import { extractText, toContentBlockParams, truncate } from '../message-helpers';

export interface SearchBudgetV2 {
  maxIters: number;
  maxPagesRead: number;
  maxTotalTokens: number;
}

const DEFAULT_BUDGET: SearchBudgetV2 = {
  maxIters: Number(process.env.FABRICK_SEARCH_V2_MAX_ITERS) || 8,
  maxPagesRead: Number(process.env.FABRICK_SEARCH_V2_MAX_PAGES_READ) || 12,
  maxTotalTokens: Number(process.env.FABRICK_SEARCH_V2_MAX_TOTAL_TOKENS) || 50_000,
};

const MAX_READ_PAGES_BATCH = 6;
const SEARCH_MODEL = 'claude-sonnet-4-6';
const PER_CALL_MAX_TOKENS = 4096;

export type StopReasonV2 = 'end_turn' | 'budget' | 'max_tokens' | 'other';

export interface SearchMetricsV2 {
  iters: number;
  pagesRead: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  stopReason: StopReasonV2;
  perCallTokens: Array<{ inputTokens: number; outputTokens: number }>;
}

export interface SearchResultV2 {
  answer: string;
  reasoning?: string;
  sources: string[];
  metrics: SearchMetricsV2;
  promptRevisionId: string;
}

const TOOL_DEFS: Tool[] = [
  {
    name: 'compendium_read',
    description:
      'Read the full content of a compendium topic page. Valid slugs: system, data-flows, transport-graph, infra. Do NOT call with slug=index — the index is already provided in the bootstrap.',
    input_schema: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
    },
  },
  {
    name: 'list_scopes',
    description: 'List all scopes (sub-directories) of a repository, with the page count per scope.',
    input_schema: {
      type: 'object',
      properties: { repo_slug: { type: 'string' } },
      required: ['repo_slug'],
    },
  },
  {
    name: 'list_in_scope',
    description: 'List pages within a repository scope as { slug, title, one_liner }.',
    input_schema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string' },
        scope: { type: 'string' },
      },
      required: ['repo_slug', 'scope'],
    },
  },
  {
    name: 'dossier_read',
    description: 'Read the full content of one dossier page identified by repo_slug + scope + slug.',
    input_schema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string' },
        scope: { type: 'string' },
        slug: { type: 'string' },
      },
      required: ['repo_slug', 'scope', 'slug'],
    },
  },
  {
    name: 'dossier_read_pages',
    description: `Read multiple dossier pages in one call. Maximum ${MAX_READ_PAGES_BATCH} refs per call. Each ref must have repo_slug, scope, slug.`,
    input_schema: {
      type: 'object',
      properties: {
        refs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              repo_slug: { type: 'string' },
              scope: { type: 'string' },
              slug: { type: 'string' },
            },
            required: ['repo_slug', 'scope', 'slug'],
          },
        },
      },
      required: ['refs'],
    },
  },
];

interface LoopState {
  iter: number;
  pagesRead: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  readSet: Set<string>;
  perCallTokens: Array<{ inputTokens: number; outputTokens: number }>;
}

interface ToolDispatchResult {
  payload: unknown;
  pageReadCount: number;
  qualifiedSlugs: string[];
}

@Injectable()
export class SearchImplV2 {
  private readonly logger = new Logger(SearchImplV2.name);
  private readonly budget: SearchBudgetV2;

  constructor(
    @Inject(COMPENDIUM_REPOSITORY) private readonly compendiumRepo: CompendiumRepository,
    @Inject(DOSSIER_REPOSITORY) private readonly dossierRepo: DossierRepository,
    @Inject(PROMPT_REPOSITORY) private readonly promptRepo: PromptRepository,
    @Optional() budget?: SearchBudgetV2,
  ) {
    this.budget = budget ?? DEFAULT_BUDGET;
  }

  // Extracted so tests can override
  protected createAnthropicClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
  }

  async search(
    projectId: string,
    question: string,
    apiKey: string,
    opts?: { reasoning?: boolean },
  ): Promise<SearchResultV2> {
    const reasoning = opts?.reasoning === true;
    const t0 = Date.now();
    this.logger.log(
      `v2 search started  projectId=${projectId}  reasoning=${reasoning}  q="${question.slice(0, 80)}"`,
    );

    const promptRecord = await this.promptRepo.getLatest('search-v2', 'claude');
    const systemPromptText = promptRecord.content.files['prompt.md'];

    const indexPage = await this.compendiumRepo.findIndex(projectId);
    if (!indexPage) {
      throw new Error('No compendium index found. Run compendium synthesis first.');
    }

    const anthropic = this.createAnthropicClient(apiKey);

    const system: TextBlockParam[] = [
      { type: 'text', text: systemPromptText, cache_control: { type: 'ephemeral' } },
    ];

    const messages: MessageParam[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Compendium index:\n\n${indexPage.content}`,
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: `Question: ${question}` }] },
    ];

    const state: LoopState = {
      iter: 0,
      pagesRead: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      readSet: new Set<string>(),
      perCallTokens: [],
    };

    let finalText: string | null = null;
    let stopReason: StopReasonV2 = 'other';

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

    const parsed = parseFinalAnswerV2(finalText ?? '');
    let sources = parsed.sources;
    if (!parsed.hadSourcesLine) {
      this.logger.warn('v2 final answer missing SOURCES: line; falling back to loop read-set');
      sources = Array.from(state.readSet);
    }
    if (!parsed.hadBriefMarker) {
      this.logger.warn('v2 final answer missing BRIEF: marker; returning full text as answer');
    }

    const durationMs = Date.now() - t0;
    this.logger.log(
      `v2 search done  iters=${state.iter}  pagesRead=${state.pagesRead}  totalTokens=${state.totalInputTokens + state.totalOutputTokens}  sources=${sources.length}  stop=${stopReason}  duration=${durationMs}ms`,
    );

    const result: SearchResultV2 = {
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
      promptRevisionId: promptRecord.id,
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
      `v2 iter ${state.iter}  stop=${response.stop_reason}  tokens(in=${usedIn} out=${usedOut} total=${state.totalInputTokens + state.totalOutputTokens})  pagesRead=${state.pagesRead}`,
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
      for (const s of result.qualifiedSlugs) state.readSet.add(s);
      this.logger.log(
        `  v2 tool=${tu.name} args=${truncate(JSON.stringify(tu.input))} pagesAdded=${result.pageReadCount}`,
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
      `v2 partial finalization  reason=${reason}  iter=${state.iter}  totalTokens=${state.totalInputTokens + state.totalOutputTokens}`,
    );
    const finalMessages: MessageParam[] = [
      ...messages,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Budget exhausted. Give a partial answer using only the pages you have already read. Use the same format: BRIEF: paragraph, optional REASONING: section, and end with a single SOURCES: <qualified-slug>, <qualified-slug>, ... line using qualified slugs (compendium/<slug> or dossier/<repo>/<scope>/<slug>).',
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

    switch (tu.name) {
      case 'compendium_read': {
        const slug = String(input.slug ?? '');
        if (slug === 'index') {
          return errorResult('index is already provided in the bootstrap; use the other compendium slugs');
        }
        if (state.pagesRead >= this.budget.maxPagesRead) {
          return errorResult(`page-read budget exhausted (max ${this.budget.maxPagesRead})`);
        }
        const page = await this.compendiumRepo.findBySlug(projectId, slug);
        if (!page) return errorResult(`compendium page not found: ${slug}`);
        const qualified = `compendium/${slug}`;
        return {
          payload: { ok: true, slug, content: page.content },
          pageReadCount: 1,
          qualifiedSlugs: [qualified],
        };
      }

      case 'list_scopes': {
        const repoSlug = String(input.repo_slug ?? '');
        if (!repoSlug) return errorResult('list_scopes requires repo_slug');
        const scopes = await this.dossierRepo.listScopes(projectId, repoSlug);
        return {
          payload: { ok: true, scopes: scopes.map((s) => ({ scope: s.scope, page_count: s.pageCount })) },
          pageReadCount: 0,
          qualifiedSlugs: [],
        };
      }

      case 'list_in_scope': {
        const repoSlug = String(input.repo_slug ?? '');
        const scope = String(input.scope ?? '');
        if (!repoSlug) return errorResult('list_in_scope requires repo_slug');
        if (!scope) return errorResult('list_in_scope requires scope');
        const pages = await this.dossierRepo.listInScope(projectId, repoSlug, scope);
        return {
          payload: {
            ok: true,
            pages: pages.map((p) => ({ slug: p.slug, title: p.title, one_liner: p.oneLiner })),
          },
          pageReadCount: 0,
          qualifiedSlugs: [],
        };
      }

      case 'dossier_read': {
        const repoSlug = String(input.repo_slug ?? '');
        const scope = String(input.scope ?? '');
        const slug = String(input.slug ?? '');
        if (!repoSlug || !scope || !slug) {
          return errorResult('dossier_read requires repo_slug, scope, and slug');
        }
        if (state.pagesRead >= this.budget.maxPagesRead) {
          return errorResult(`page-read budget exhausted (max ${this.budget.maxPagesRead})`);
        }
        const page = await this.dossierRepo.findPage(projectId, repoSlug, scope, slug);
        if (!page) return errorResult(`page not found: dossier/${repoSlug}/${scope}/${slug}`);
        const qualified = `dossier/${repoSlug}/${scope}/${slug}`;
        return {
          payload: { ok: true, repo_slug: repoSlug, scope, slug, content: page.content },
          pageReadCount: 1,
          qualifiedSlugs: [qualified],
        };
      }

      case 'dossier_read_pages': {
        const refs = Array.isArray(input.refs) ? (input.refs as unknown[]) : [];
        if (refs.length === 0) return errorResult('dossier_read_pages requires a non-empty refs array');
        if (refs.length > MAX_READ_PAGES_BATCH) {
          return errorResult(
            `dossier_read_pages accepts at most ${MAX_READ_PAGES_BATCH} refs per call (got ${refs.length})`,
          );
        }
        if (state.pagesRead >= this.budget.maxPagesRead) {
          return errorResult(`page-read budget exhausted (max ${this.budget.maxPagesRead})`);
        }
        const normalizedRefs = refs.map((r: any) => ({
          repoSlug: String(r.repo_slug ?? ''),
          scope: String(r.scope ?? ''),
          slug: String(r.slug ?? ''),
        }));
        const pages = await this.dossierRepo.findPages(projectId, normalizedRefs);
        const foundKeys = new Set(pages.map((p) => `${p.repoSlug}/${p.scope}/${p.slug}`));
        const missing = normalizedRefs.filter(
          (r) => !foundKeys.has(`${r.repoSlug}/${r.scope}/${r.slug}`),
        );
        const qualifiedSlugs = pages.map((p) => `dossier/${p.repoSlug}/${p.scope}/${p.slug}`);
        return {
          payload: {
            ok: true,
            pages: pages.map((p) => ({
              repo_slug: p.repoSlug,
              scope: p.scope,
              slug: p.slug,
              content: p.content,
            })),
            missing: missing.map((r) => ({ repo_slug: r.repoSlug, scope: r.scope, slug: r.slug })),
          },
          pageReadCount: pages.length,
          qualifiedSlugs,
        };
      }

      default:
        return errorResult(`unknown tool: ${tu.name}`);
    }
  }
}

function errorResult(message: string): ToolDispatchResult {
  return { payload: { ok: false, error: message }, pageReadCount: 0, qualifiedSlugs: [] };
}

