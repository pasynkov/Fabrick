import { Body, Controller, Headers, HttpCode, InternalServerErrorException, Post, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { CompendiumJwtService } from './services/compendium-jwt.service';
import { CompendiumBundleService, BundleRef } from './services/compendium-bundle.service';
import { ProcessCompendiumResultCommand } from './commands/process-compendium-result.command';
import { CompendiumCallbackDto } from './dto/compendium-callback.dto';

@Controller({ path: 'internal/compendium', version: '2' })
export class CompendiumInternalController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly jwtService: CompendiumJwtService,
    private readonly bundleService: CompendiumBundleService,
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
  ) {}

  @Post('callback')
  @HttpCode(200)
  async callback(
    @Body() dto: CompendiumCallbackDto,
    @Headers('authorization') authHeader: string,
  ): Promise<{ ok: boolean }> {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = authHeader.slice(7);

    this.jwtService.verify(token, dto.jobId);

    const resultRef: BundleRef = {
      container: dto.resultBundleRef.container,
      key: dto.resultBundleRef.key,
      hash: dto.resultBundleRef.hash,
    };

    let result: any;
    try {
      result = await this.bundleService.download(resultRef);
    } catch {
      throw new InternalServerErrorException('Failed to download result bundle');
    }

    // Input key is derived from result key: <orgSlug>/compendium-jobs/<id>-<hash>.result.json -> .json
    const inputRef: BundleRef = {
      container: dto.resultBundleRef.container,
      key: dto.resultBundleRef.key.replace('.result.json', '.json'),
      hash: '',
    };

    const resolvedProjectId = result.projectId;
    if (!resolvedProjectId) throw new InternalServerErrorException('Invalid result bundle: missing projectId');

    const project = await this.projectRepo.findOne({
      where: { id: resolvedProjectId },
      relations: ['org'],
    });
    if (!project) throw new InternalServerErrorException('Project not found');

    const orgId = project.orgId;

    await this.commandBus.execute(
      new ProcessCompendiumResultCommand(
        dto.jobId,
        resolvedProjectId,
        orgId,
        result,
        inputRef,
        resultRef,
      ),
    );

    return { ok: true };
  }
}
