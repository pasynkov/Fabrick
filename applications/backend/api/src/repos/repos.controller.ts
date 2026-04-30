import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
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
import { IsAdminGuard } from '../auth/is-admin.guard';
import { StorageService } from '../storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateRepoDto } from './dto/create-repo.dto';
import { FindOrCreateRepoDto } from './dto/find-or-create-repo.dto';
import { UpdateProjectNameDto } from './dto/update-project-name.dto';
import { ReposService } from './repos.service';

@Controller()
export class ReposController {
  constructor(
    private readonly reposService: ReposService,
    private readonly storageService: StorageService,
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
  updateProjectName(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectNameDto,
  ) {
    return this.reposService.updateProjectName(orgId, projectId, body.name, req.user.id);
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
