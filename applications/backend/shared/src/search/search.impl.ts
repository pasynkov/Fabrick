import { Inject, Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { WIKI_REPOSITORY, WikiRepository } from '../wiki-repository.interface';

@Injectable()
export class SearchImpl {
  private readonly logger = new Logger(SearchImpl.name);

  constructor(
    @Inject(WIKI_REPOSITORY) private readonly wikiRepo: WikiRepository,
  ) {}

  async search(
    projectId: string,
    question: string,
    apiKey: string,
  ): Promise<{ answer: string; sources: string[] }> {
    this.logger.log(`search started  projectId=${projectId}  question=${question}`);
    const indexPage = await this.wikiRepo.findBySlug(projectId, 'index');
    if (!indexPage) {
      throw new Error('No wiki pages found. Run synthesis first.');
    }

    const anthropic = new Anthropic({ apiKey });

    // Claude #1: select relevant page slugs from index
    const slugSelectionResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are a search assistant. Given a wiki index and a question, return ONLY a JSON array of page slugs most relevant to the question. Return at most 5 slugs. Example: ["entities/user", "logic/auth-flow"]',
      messages: [{
        role: 'user',
        content: `Wiki index:\n${indexPage.content}\n\nQuestion: ${question}\n\nReturn only a JSON array of relevant page slugs.`,
      }],
    });

    const slugsText = (slugSelectionResponse.content.find((c) => c.type === 'text') as any)?.text ?? '[]';
    let selectedSlugs: string[] = [];
    try {
      const match = slugsText.match(/\[[\s\S]*\]/);
      selectedSlugs = match ? JSON.parse(match[0]) : [];
    } catch {
      selectedSlugs = [];
    }
    selectedSlugs = selectedSlugs.map((s) => s.replace(/\.md$/i, ''));
    this.logger.log(`slug selection  selected=${JSON.stringify(selectedSlugs)}`);

    if (selectedSlugs.length === 0) {
      return { answer: 'No relevant information found in the project wiki for this question.', sources: [] };
    }

    const pages = await this.wikiRepo.findBySlugs(projectId, selectedSlugs);
    this.logger.log(`pages loaded    count=${pages.length}  slugs=${JSON.stringify(pages.map((p) => p.slug))}`);

    if (pages.length === 0) {
      return { answer: 'No relevant information found in the project wiki for this question.', sources: [] };
    }

    const pagesText = pages.map((p) => `=== ${p.slug} ===\n${p.content}`).join('\n\n');

    // Claude #2: generate answer from selected pages
    const answerResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'You are a helpful assistant answering questions about a software project based on its wiki. Be concise and specific. Use markdown formatting.',
      messages: [{
        role: 'user',
        content: `Wiki pages:\n${pagesText}\n\nQuestion: ${question}`,
      }],
    });

    const answer = (answerResponse.content.find((c) => c.type === 'text') as any)?.text ?? 'No answer generated.';
    const sources = pages.map((p) => p.slug);

    this.logger.log(`search answered: ${sources.length} pages used`);
    return { answer, sources };
  }
}
