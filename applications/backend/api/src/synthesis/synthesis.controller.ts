import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { RecordTokenUsageDto } from './dto/record-token-usage.dto';
import { SynthesisCallbackDto } from './dto/synthesis-callback.dto';
import { UpsertWikiPagesDto } from './dto/upsert-wiki-pages.dto';
import { DeleteWikiPagesDto } from './dto/delete-wiki-pages.dto';
import { SynthesisService } from './synthesis.service';

@Controller({ version: '1' })
export class SynthesisController {
  constructor(private readonly synthesisService: SynthesisService) {}

  @Post('internal/synthesis/status')
  @HttpCode(204)
  async synthesisCallback(
    @Headers('authorization') auth: string,
    @Body() body: SynthesisCallbackDto,
  ): Promise<void> {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice(7);
    await this.synthesisService.updateStatusFromCallback(token, body.projectId, body.status, body.error);
  }

  @Put('internal/synthesis/pages')
  @HttpCode(200)
  async upsertWikiPages(@Body() body: UpsertWikiPagesDto): Promise<void> {
    this.synthesisService.verifyCallbackToken(body.callbackToken, body.projectId);
    await this.synthesisService.upsertPages(body.projectId, body.pages);
  }

  @Get('internal/synthesis/pages')
  async getWikiPages(@Query('projectId') projectId: string, @Query('callbackToken') callbackToken: string) {
    if (!projectId || !callbackToken) throw new BadRequestException('projectId and callbackToken are required');
    this.synthesisService.verifyCallbackToken(callbackToken, projectId);
    const pages = await this.synthesisService.getPagesByProject(projectId);
    return { pages };
  }

  @Delete('internal/synthesis/pages')
  @HttpCode(200)
  async deleteWikiPages(@Body() body: DeleteWikiPagesDto): Promise<void> {
    this.synthesisService.verifyCallbackToken(body.callbackToken, body.projectId);
    await this.synthesisService.deletePagesBySlugs(body.projectId, body.slugs);
  }

  @Post('internal/synthesis/token-usage')
  @HttpCode(204)
  async recordTokenUsage(@Body() body: RecordTokenUsageDto): Promise<void> {
    this.synthesisService.verifyCallbackToken(body.callbackToken, body.projectId);
    await this.synthesisService.recordSynthesisTokenUsage(
      body.projectId,
      body.inputTokens,
      body.outputTokens,
      body.promptRevisionId,
    );
  }

  @Post('projects/:id/synthesis')
  @HttpCode(202)
  @UseGuards(FabrickAuthGuard)
  async trigger(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ): Promise<void> {
    await this.synthesisService.triggerForProject(id, req.user.id);
  }

  @Get('projects/:id/synthesis/status')
  @UseGuards(FabrickAuthGuard)
  async getStatus(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.synthesisService.getStatus(id, req.user.id);
  }

  @Get('projects/:id/synthesis')
  @UseGuards(FabrickAuthGuard)
  async getFiles(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    const files = await this.synthesisService.getFiles(id, req.user.id);
    if (Object.keys(files).length === 0) throw new NotFoundException('No synthesis files found');
    return files;
  }

  @Get('orgs/:orgSlug/projects/:projectSlug/synthesis/file')
  @UseGuards(FabrickAuthGuard)
  async getSynthesisFile(
    @Request() req: { user: { id: string } },
    @Param('orgSlug') orgSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Query('path') filePath: string,
    @Res() res: Response,
  ) {
    if (!filePath) throw new BadRequestException('path query parameter is required');
    const content = await this.synthesisService.getSynthesisFileBySlug(
      req.user.id,
      orgSlug,
      projectSlug,
      filePath,
    );
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  }

  @Get('orgs/:orgSlug/projects/:projectSlug/synthesis/pages')
  @UseGuards(FabrickAuthGuard)
  async getWikiPagesPublic(
    @Request() req: { user: { id: string } },
    @Param('orgSlug') orgSlug: string,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.synthesisService.getPublicPages(req.user.id, orgSlug, projectSlug);
  }
}
