import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { CliTokenGuard } from '../auth/cli-token.guard';

@Controller('skills')
@UseGuards(CliTokenGuard)
export class SkillsController {
  @Get(':tool')
  download(@Param('tool') tool: string, @Res() res: Response): void {
    const zipPath = join(__dirname, '..', 'assets', `${tool}-skills.zip`);
    if (!existsSync(zipPath)) {
      throw new NotFoundException(`No skills found for tool: ${tool}`);
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${tool}-skills.zip"`);
    res.sendFile(zipPath);
  }
}
