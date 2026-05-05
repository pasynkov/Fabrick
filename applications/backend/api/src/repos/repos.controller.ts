import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as unzipper from 'unzipper';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { IsAdminGuard } from '../auth/is-admin.guard';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';
import { AuditLogsQueryDto } from '../api-keys/dto/audit-logs-query.dto';
import { StorageService } from '../storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateRepoDto } from './dto/create-repo.dto';
import { FindOrCreateRepoDto } from './dto/find-or-create-repo.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ReposService } from './repos.service';

@Controller()
export class ReposController {
  constructor(
    private readonly reposService: ReposService,
    private readonly storageService: StorageService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
  ) {}

  @Post('orgs/:orgId/projects')
  @HttpCode(201)
  @UseGuards(FabrickAuthGuard)
  createProject(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Body() body: CreateProjectDto,
  ) {
    return this.reposService.createProject(req.user.id, orgId, body.name);
  }

  @Get('orgs/:orgId/projects')
  @UseGuards(FabrickAuthGuard)
  listProjects(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
  ) {
    return this.reposService.listProjects(req.user.id, orgId);
  }

  @Post('projects/:projectId/repos')
  @HttpCode(201)
  @UseGuards(FabrickAuthGuard)
  createRepo(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() body: CreateRepoDto,
  ) {
    return this.reposService.createRepo(req.user.id, projectId, body.name, body.gitRemote);
  }

  @Get('projects/:projectId/repos')
  @UseGuards(FabrickAuthGuard)
  listRepos(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.reposService.listRepos(req.user.id, projectId);
  }

  @Post('repos/find-or-create')
  @UseGuards(FabrickAuthGuard)
  async findOrCreateRepo(
    @Request() req: { user: { id: string } },
    @Body() body: FindOrCreateRepoDto,
  ) {
    const result = await this.reposService.findOrCreateRepo(
      req.user.id,
      body.gitRemote,
      body.projectId,
    );
    return result.repo;
  }

  @Patch('orgs/:orgId/projects/:projectId')
  @UseGuards(FabrickAuthGuard, IsAdminGuard)
  updateProject(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ) {
    return this.reposService.updateProject(orgId, projectId, body, req.user.id, {
      userId: req.user.id,
      ipAddress: forwardedFor?.split(',')[0]?.trim() || null,
      userAgent,
    });
  }

  @Get('projects/:projectId/api-key/status')
  @UseGuards(FabrickAuthGuard)
  getProjectApiKeyStatus(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.reposService.getProjectApiKeyStatus(req.user.id, projectId);
  }

  @Get('projects/:projectId/api-key/audit-logs')
  @UseGuards(FabrickAuthGuard, IsAdminGuard)
  getProjectAuditLogs(
    @Param('projectId') projectId: string,
    @Query() query: AuditLogsQueryDto,
  ) {
    return this.apiKeyAuditService.getProjectAuditLogs(projectId, query.limit, query.offset);
  }

  @Post('repos/:repoId/context')
  @HttpCode(201)
  @UseGuards(FabrickAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadContext(
    @Request() req: { user: { id: string } },
    @Param('repoId') repoId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<void> {
    if (!file) throw new BadRequestException('file field is required');

    await this.reposService.requireOrgMemberByRepo(req.user.id, repoId);

    const { orgSlug, projectSlug, repo } = await this.reposService.getRepoWithContext(repoId);
    const directory = await unzipper.Open.buffer(file.buffer);
    for (const entry of directory.files) {
      if (entry.type === 'File') {
        const content = await entry.buffer();
        await this.storageService.putObject(
          orgSlug,
          `${projectSlug}/${repo.slug}/context/${entry.path}`,
          content,
        );
      }
    }
  }
}
