import { Injectable } from '@nestjs/common';
import { FrontmatterService } from './frontmatter.service';
import { APP_PAGE_SLUGS } from './llm/prompts';

@Injectable()
export class IndexService {
  constructor(private readonly frontmatter: FrontmatterService) {}

  build(pages: Record<string, string>, scopeName: string): string {
    const lines = [`# ${scopeName} — Dossier Index`, ''];
    for (const slug of APP_PAGE_SLUGS) {
      const body = pages[slug];
      if (!body) continue;
      const { meta } = this.frontmatter.parse(body);
      const title = (meta.name as string) ?? slug;
      const description = (meta.description as string) ?? this.frontmatter.firstSentence(body);
      lines.push(`- [${title}](${slug})${description ? ` — ${description}` : ''}`);
    }
    lines.push('');
    return lines.join('\n');
  }
}
