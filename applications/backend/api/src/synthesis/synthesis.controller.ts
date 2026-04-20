import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AnyAuthGuard } from '../auth/any-auth.guard';
import { SynthesisService } from './synthesis.service';

@Controller()
export class SynthesisController {
  constructor(private readonly synthesisService: SynthesisService) {}

  @Post('projects/:id/synthesis')
  @HttpCode(202)
  @UseGuards(AnyAuthGuard)
  async trigger(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ): Promise<void> {
    await this.synthesisService.triggerForProject(id, req.user.id);
  }

  @Get('projects/:id/synthesis/status')
  @UseGuards(AnyAuthGuard)
  async getStatus(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.synthesisService.getStatus(id, req.user.id);
  }

  @Get('projects/:id/synthesis')
  @UseGuards(AnyAuthGuard)
  async getFiles(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    const files = await this.synthesisService.getFiles(id, req.user.id);
    if (Object.keys(files).length === 0) throw new NotFoundException('No synthesis files found');
    return files;
  }
}
