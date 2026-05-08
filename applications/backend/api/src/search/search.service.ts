import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { WikiPage } from '../entities/wiki-page.entity';
import { OrgMember } from '../entities/org-member.entity';
import { ApiKeyResolutionService } from '../api-keys/api-key-resolution.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(WikiPage)
    private readonly wikiPageRepo: TypeOrmRepository<WikiPage>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
  ) {}

  async search(
    userId: string,
    orgSlug: string,
    projectSlug: string,
    question: string,
  ): Promise<{ answer: string; sources: string[] }> {
    const org = await this.orgRepo.findOne({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException('Project not found');

    const member = await this.memberRepo.findOne({ where: { orgId: org.id, userId } });
    if (!member) throw new NotFoundException('Project not found');

    const project = await this.projectRepo.findOne({ where: { orgId: org.id, slug: projectSlug } });
    if (!project) throw new NotFoundException('Project not found');

    const resolution = await this.apiKeyResolutionService.resolveForProject(project.id);
    if (!resolution.apiKey) {
      throw new BadRequestException('No Anthropic API key configured. Set one in project or organization settings.');
    }

    // Load index page
    const indexPage = await this.wikiPageRepo.findOne({ where: { projectId: project.id, slug: 'index' } });
    if (!indexPage) {
      throw new BadRequestException('No wiki pages found. Run synthesis first.');
    }

    const anthropic = new Anthropic({ apiKey: resolution.apiKey });

    // LLM call #1: select relevant page slugs from index
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

    if (selectedSlugs.length === 0) {
      return { answer: 'No relevant information found in the project wiki for this question.', sources: [] };
    }

    // Load selected pages
    const pages = await this.wikiPageRepo
      .createQueryBuilder('p')
      .where('p.projectId = :projectId AND p.slug = ANY(:slugs)', {
        projectId: project.id,
        slugs: selectedSlugs,
      })
      .getMany();

    if (pages.length === 0) {
      return { answer: 'No relevant information found in the project wiki for this question.', sources: [] };
    }

    const pagesText = pages
      .map((p) => `=== ${p.slug} ===\n${p.content}`)
      .join('\n\n');

    // LLM call #2: formulate answer from selected pages
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

    this.logger.log(`[${projectSlug}] search answered: ${sources.length} pages used`);
    return { answer, sources };
  }
}
