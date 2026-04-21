import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as unzipper from 'unzipper';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { MinioService } from '../minio/minio.service';
import { ReposService } from './repos.service';

@Controller()
export class ReposController {
  constructor(
    private readonly reposService: ReposService,
    private readonly minioService: MinioService,
  ) {}

  @Post('orgs/:orgId/projects')
  @HttpCode(201)
  @UseGuards(FabrickAuthGuard)
  createProject(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Body() body: { name: string },
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
    @Body() body: { name: string; gitRemote: string },
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
    @Body() body: { gitRemote: string; projectId: string },
  ) {
    const result = await this.reposService.findOrCreateRepo(
      req.user.id,
      body.gitRemote,
      body.projectId,
    );
    return result.repo;
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
        await this.minioService.putObject(
          orgSlug,
          `${projectSlug}/${repo.slug}/context/${entry.path}`,
          content,
        );
      }
    }
  }
}
