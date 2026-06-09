import { Injectable } from '@nestjs/common';
import { ClaudeCodeService } from './llm/claude-code.service';
import { extractMarkdownSymbols, diffMarkdownFingerprints, renderMarkdownDiff } from './extract/markdown';
import { describeChangePrompt } from './llm/prompts';

@Injectable()
export class SummarizeScopeService {
  constructor(private readonly claude: ClaudeCodeService) {}

  async describe(opts: {
    mode: string;
    before: Record<string, string>;
    after: Record<string, string>;
    slugs: string[];
    cwd?: string;
  }): Promise<string> {
    const { mode, before, after, slugs, cwd } = opts;
    if (mode === 'delete') return 'Scope removed.';

    const slugCounts: Record<string, { added: number; removed: number; changed: number }> = {};
    const DIFF_CAP = 6000;
    const diffBlocks: string[] = [];

    for (const slug of slugs) {
      const a = before[slug] ?? '';
      const b = after[slug] ?? '';
      if (a === b) continue;
      const symsA = extractMarkdownSymbols(slug, a);
      const symsB = extractMarkdownSymbols(slug, b);
      const d = diffMarkdownFingerprints(symsA, symsB);
      slugCounts[slug] = { added: d.added.length, removed: d.deleted.length, changed: d.changed.length };
      diffBlocks.push(renderMarkdownDiff(slug, d));
      if (diffBlocks.join('\n').length > DIFF_CAP) break;
    }

    const slugLines = Object.entries(slugCounts).map(([slug, c]) => `${slug}: +${c.added} -${c.removed} ~${c.changed}`).join('\n');
    if (!slugLines) return 'No detectable changes.';

    let diffText = diffBlocks.join('\n');
    if (diffText.length > DIFF_CAP) diffText = diffText.slice(0, DIFF_CAP) + '\n... (truncated)';

    const { system, user } = describeChangePrompt(mode, slugLines, diffText);

    try {
      const res = await this.claude.call({ model: 'claude-haiku-4-5', systemPrompt: system, userInput: user, cwd });
      const text = res.content.trim().split('\n')[0].slice(0, 240);
      // Bound to ≤30 words
      const words = text.split(/\s+/);
      if (words.length > 30) return words.slice(0, 30).join(' ') + '…';
      return text || 'No description available.';
    } catch (e: any) {
      return `(describe failed: ${e.message?.slice(0, 80)}) — ${slugLines.replace(/\n/g, '; ')}`;
    }
  }
}
