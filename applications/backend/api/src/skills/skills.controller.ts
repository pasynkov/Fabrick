import { Controller, Get, Logger, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as AdmZip from 'adm-zip';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { DbPromptRepository } from '../prompts/db-prompt.repository';

export function injectSkillVersion(body: string, revision: number): string {
  if (!body.startsWith('---')) {
    return body;
  }

  const endIdx = body.indexOf('\n---', 3);
  if (endIdx === -1) {
    return body;
  }

  const frontmatter = body.slice(3, endIdx);
  const rest = body.slice(endIdx + 4);
  const versionValue = `1.${revision}`;

  if (/^version:\s*.+$/m.test(frontmatter)) {
    const updated = frontmatter.replace(/^version:\s*.+$/m, `version: ${versionValue}`);
    return `---${updated}\n---${rest}`;
  } else {
    return `---${frontmatter}\nversion: ${versionValue}\n---${rest}`;
  }
}

@Controller({ path: 'skills', version: '1' })
@UseGuards(FabrickAuthGuard)
export class SkillsController {
  private readonly logger = new Logger(SkillsController.name);

  constructor(private readonly promptRepo: DbPromptRepository) {}

  @Get(':tool')
  async download(@Param('tool') tool: string, @Res() res: Response): Promise<void> {
    if (tool !== 'claude') {
      throw new NotFoundException(`No skills found for tool: ${tool}`);
    }

    const prompts = await this.promptRepo.findAllFabrickLatest();

    if (prompts.length === 0) {
      throw new NotFoundException('No fabrick skills found in database');
    }

    const zip = new AdmZip();

    for (const prompt of prompts) {
      const dirName = prompt.name;
      for (const [filename, content] of Object.entries(prompt.content.files)) {
        let fileContent = content;
        if (filename === 'SKILL.md') {
          fileContent = injectSkillVersion(content, prompt.revision);
        }
        zip.addFile(`${dirName}/${filename}`, Buffer.from(fileContent, 'utf-8'));
      }
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${tool}-skills.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  }
}
