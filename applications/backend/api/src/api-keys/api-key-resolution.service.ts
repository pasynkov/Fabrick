import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { ApiKeyEncryptionService } from './api-key-encryption.service';

export interface ApiKeyResolution {
  apiKey: string;
  source: 'project' | 'organization';
  projectId?: string;
  orgId?: string;
}

@Injectable()
export class ApiKeyResolutionService {
  private readonly logger = new Logger(ApiKeyResolutionService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly encryptionService: ApiKeyEncryptionService,
  ) {}

  async resolveForProject(projectId: string): Promise<ApiKeyResolution> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['org'],
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (project.anthropicApiKey) {
      try {
        const decryptedKey = this.encryptionService.decrypt(project.anthropicApiKey);
        this.logger.debug(`Using project-level API key for project ${projectId}`);
        return {
          apiKey: decryptedKey,
          source: 'project',
          projectId: project.id,
          orgId: project.orgId,
        };
      } catch (error: any) {
        this.logger.warn(`Failed to decrypt project API key for ${projectId}: ${error.message}`);
      }
    }

    const org = (project as any).org as Organization;
    if (org?.anthropicApiKey) {
      try {
        const decryptedKey = this.encryptionService.decrypt(org.anthropicApiKey);
        this.logger.debug(`Using organization-level API key for project ${projectId}`);
        return {
          apiKey: decryptedKey,
          source: 'organization',
          projectId: project.id,
          orgId: org.id,
        };
      } catch (error: any) {
        this.logger.warn(`Failed to decrypt org API key for ${org.id}: ${error.message}`);
      }
    }

    throw new Error(`No API key available for project ${projectId}. Please configure an API key for this project or organization.`);
  }

  async resolveForOrganization(orgId: string): Promise<ApiKeyResolution> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });

    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    if (org.anthropicApiKey) {
      try {
        const decryptedKey = this.encryptionService.decrypt(org.anthropicApiKey);
        this.logger.debug(`Using organization-level API key for org ${orgId}`);
        return {
          apiKey: decryptedKey,
          source: 'organization',
          orgId: org.id,
        };
      } catch (error: any) {
        this.logger.warn(`Failed to decrypt org API key for ${orgId}: ${error.message}`);
      }
    }

    throw new Error(`No API key available for organization ${orgId}. Please configure an API key for this organization.`);
  }

  validateResolution(resolution: ApiKeyResolution): boolean {
    return !!(resolution.apiKey && resolution.source && resolution.apiKey.startsWith('sk-ant-'));
  }
}
