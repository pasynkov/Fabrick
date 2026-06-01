import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { DbPromptRepository } from './db-prompt.repository';
import { CreatePromptRevisionDto } from './dto/create-prompt-revision.dto';

// Internal (no auth) controller for synthesis worker
@Controller({ path: 'internal/prompts', version: '1' })
export class InternalPromptsController {
  constructor(private readonly promptRepo: DbPromptRepository) {}

  @Get(':name/:agent/latest')
  async getLatestInternal(
    @Param('name') name: string,
    @Param('agent') agent: string,
  ) {
    const row = await this.promptRepo.findLatestForNameAgent(name, agent);
    if (!row) throw new NotFoundException(`No prompt found for (${name}, ${agent})`);
    return {
      id: row.id,
      name: row.name,
      agent: row.agent,
      revision: row.revision,
      content: row.content,
    };
  }
}

@Controller({ path: 'admin/prompts', version: '1' })
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PromptsController {
  constructor(private readonly promptRepo: DbPromptRepository) {}

  @Get()
  async list() {
    const rows = await this.promptRepo.findAllLatest();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      agent: r.agent,
      revision: r.revision,
      updatedAt: r.createdAt,
      note: r.note,
      createdBy: r.createdBy,
    }));
  }

  @Get(':name/:agent')
  async getLatest(
    @Param('name') name: string,
    @Param('agent') agent: string,
  ) {
    const row = await this.promptRepo.findLatestForNameAgent(name, agent);
    if (!row) throw new NotFoundException(`No prompt found for (${name}, ${agent})`);
    return row;
  }

  @Get(':name/:agent/history')
  async getHistory(
    @Param('name') name: string,
    @Param('agent') agent: string,
  ) {
    return this.promptRepo.findHistoryForNameAgent(name, agent);
  }

  @Get(':name/:agent/:revision')
  async getRevision(
    @Param('name') name: string,
    @Param('agent') agent: string,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    const row = await this.promptRepo.findByRevision(name, agent, revision);
    if (!row) throw new NotFoundException(`No prompt found for (${name}, ${agent}, ${revision})`);
    return row;
  }

  @Post(':name/:agent')
  @HttpCode(201)
  async createRevision(
    @Param('name') name: string,
    @Param('agent') agent: string,
    @Body() dto: CreatePromptRevisionDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!dto.files || Object.keys(dto.files).length === 0) {
      throw new BadRequestException('files must not be empty');
    }

    const maxRevision = await this.promptRepo.getMaxRevision(name, agent);
    const nextRevision = maxRevision + 1;

    const entity = await this.promptRepo.insert({
      name,
      agent,
      revision: nextRevision,
      content: { files: dto.files },
      note: dto.note,
      createdBy: req.user.id,
    });

    return { id: entity.id, revision: entity.revision };
  }
}
