import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { SearchImpl } from '@app/shared';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { OrgMember } from '../entities/org-member.entity';
import { ApiKeyResolutionService } from '../api-keys/api-key-resolution.service';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly searchImpl: SearchImpl,
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

    try {
      return await this.searchImpl.search(project.id, question, resolution.apiKey);
    } catch (err: any) {
      if (err.message?.includes('No wiki pages found')) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
