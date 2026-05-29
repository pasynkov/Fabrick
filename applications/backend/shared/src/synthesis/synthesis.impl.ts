import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { WikiPageData, ExistingPage } from '../wiki-page.types';
import { SYNTHESIS_SYSTEM_PROMPT } from './synthesis-prompt';

export interface RepoWikiInput {
  slug: string;
  files: { path: string; content: string }[];
  indexContent?: string;
}

@Injectable()
export class SynthesisImpl {
  private readonly logger = new Logger(SynthesisImpl.name);

  buildContext(
    repoWikis: RepoWikiInput[],
    existingPages: ExistingPage[],
    changedRepos: string[],
  ): string {
    const hasExisting = existingPages.length > 0;
    const isIncremental = hasExisting && changedRepos.length > 0 && changedRepos.length < repoWikis.length;

    const contextBlocks: string[] = [];

    for (const repo of repoWikis) {
      const isChanged = changedRepos.includes(repo.slug);

      if (isIncremental && !isChanged) {
        if (repo.indexContent) {
          contextBlocks.push(`=== REPO-INDEX: ${repo.slug} ===\n${repo.indexContent}`);
        }
      } else {
        if (repo.files.length === 0) continue;
        let block = `=== REPO: ${repo.slug} ===\n`;
        for (const file of repo.files) {
          block += file.content + '\n\n';
        }
        contextBlocks.push(block);
      }
    }

    if (isIncremental) {
      for (const page of existingPages) {
        contextBlocks.push(
          `=== EXISTING: ${page.slug} ===\n---\nslug: ${page.slug}\ncategory: ${page.category}\ntitle: ${page.title}\nsources: [${page.sources.join(', ')}]\nrelated: [${page.related.join(', ')}]\n---\n${page.content}`,
        );
      }
    }

    return contextBlocks.join('\n\n');
  }

  async synthesize(
    context: string,
    apiKey: string,
  ): Promise<{ rawText: string; usage: { inputTokens: number; outputTokens: number } | null }> {
    const anthropic = new Anthropic({ apiKey });
    let rawText = '';
    let stopReason: string | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 32000,
      system: SYNTHESIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        rawText += event.delta.text;
      } else if (event.type === 'message_delta') {
        stopReason = event.delta.stop_reason ?? null;
        if (event.usage?.output_tokens != null) outputTokens = event.usage.output_tokens;
      } else if (event.type === 'message_start') {
        if (event.message?.usage?.input_tokens != null) inputTokens = event.message.usage.input_tokens;
        if (event.message?.usage?.output_tokens != null) outputTokens = event.message.usage.output_tokens;
      }
    }

    this.logger.log(
      `synthesis response ${rawText.length} chars, stop_reason=${stopReason}, usage(in=${inputTokens ?? '?'} out=${outputTokens ?? '?'})`,
    );

    if (stopReason === 'max_tokens') {
      throw new Error('Anthropic response truncated (max_tokens reached)');
    }

    const usage =
      inputTokens != null && outputTokens != null
        ? { inputTokens, outputTokens }
        : null;
    return { rawText, usage };
  }

  parseResponse(rawText: string): { pages: WikiPageData[]; deleteSlugs: string[] } {
    const pages: WikiPageData[] = [];
    const deleteSlugs: string[] = [];

    const parts = rawText.split(/\n?=== (?:PAGE|DELETE): /);

    for (const part of parts.slice(1)) {
      const markerEnd = part.indexOf(' ===');
      if (markerEnd === -1) {
        const nlEnd = part.indexOf('\n');
        if (nlEnd === -1) continue;
        const slug = part.slice(0, nlEnd).trim();
        deleteSlugs.push(slug);
        continue;
      }

      const slug = part.slice(0, markerEnd).trim();
      const rest = part.slice(markerEnd + 4).replace(/^\r?\n/, '');

      if (rest.trim() === '' && !rawText.includes(`=== PAGE: ${slug}`)) {
        deleteSlugs.push(slug);
        continue;
      }

      const frontmatterMatch = rest.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!frontmatterMatch) continue;

      const yamlStr = frontmatterMatch[1];
      const content = frontmatterMatch[2].trim();

      const page = this.parseFrontmatter(slug, yamlStr, content);
      if (page) pages.push(page);
    }

    const deleteMatches = rawText.matchAll(/=== DELETE: ([^\s=]+) ===/g);
    for (const match of deleteMatches) {
      const slug = match[1].trim();
      if (!deleteSlugs.includes(slug)) deleteSlugs.push(slug);
    }

    return { pages, deleteSlugs };
  }

  parseFrontmatter(slug: string, yaml: string, content: string): WikiPageData | null {
    const slugMatch = yaml.match(/^slug:\s*(.+)$/m);
    const categoryMatch = yaml.match(/^category:\s*(.+)$/m);
    const titleMatch = yaml.match(/^title:\s*(.+)$/m);

    const parsedSlug = slugMatch?.[1]?.trim() ?? slug;
    const category = categoryMatch?.[1]?.trim() ?? 'overview';
    const title = titleMatch?.[1]?.trim() ?? parsedSlug;

    const sourcesBlockMatch = yaml.match(/^sources:\s*\n((?:\s*-\s*.+\n?)*)/m);
    const sourcesInlineMatch = yaml.match(/^sources:\s*\[([^\]]*)\]/m);
    let sources: string[] = [];
    if (sourcesBlockMatch) {
      sources = sourcesBlockMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    } else if (sourcesInlineMatch) {
      sources = sourcesInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    }

    const relatedBlockMatch = yaml.match(/^related:\s*\n((?:\s*-\s*.+\n?)*)/m);
    const relatedInlineMatch = yaml.match(/^related:\s*\[([^\]]*)\]/m);
    let related: string[] = [];
    if (relatedBlockMatch) {
      related = relatedBlockMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    } else if (relatedInlineMatch) {
      related = relatedInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    }

    return { slug: parsedSlug, category, title, content, sources, related };
  }
}
