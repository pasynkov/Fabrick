import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { SynthesisCallbackDto } from './dto/synthesis-callback.dto';
import { SynthesisService } from './synthesis.service';

@Controller()
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
}
