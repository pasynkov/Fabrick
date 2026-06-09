import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { StorageService } from '../../../storage/storage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Repository } from '../../../entities/repository.entity';
import { DossierPage } from '../../entities/dossier-page.entity';
import { CompendiumPage } from '../../entities/compendium-page.entity';

export interface BundleRef {
  container: string;
  key: string;
  hash: string;
}

export interface CompendiumInputBundle {
  projectId: string;
  dossierUpdatedId: string;
  currentCompendium: any | null;
  currentDossiers: Record<string, any>;
  projectMeta: { repos: Array<{ id: string; slug: string; name: string }> };
  repos: Array<{ slug: string; name: string; scopes: string[] }>;
}

@Injectable()
export class CompendiumBundleService {
  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @InjectRepository(DossierPage)
    private readonly dossierPageRepo: TypeOrmRepository<DossierPage>,
    @InjectRepository(CompendiumPage)
    private readonly compendiumPageRepo: TypeOrmRepository<CompendiumPage>,
  ) {}

  async assembleAndUpload(
    orgSlug: string,
    projectId: string,
    dossierUpdatedId: string,
  ): Promise<{ ref: BundleRef; repoSlugs: string[] }> {
    const [repos, compendiumPages, allDossierPages] = await Promise.all([
      this.repoRepo.find({ where: { projectId } }),
      this.compendiumPageRepo.find({ where: { projectId } }),
      this.dossierPageRepo.find({ where: { projectId } }),
    ]);

    const currentCompendium =
      compendiumPages.length > 0
        ? { pages: compendiumPages.map((p) => ({ slug: p.slug, title: p.title, content: p.content, sources: p.sources, related: p.related })) }
        : null;

    const currentDossiers: Record<string, any> = {};
    for (const repo of repos) {
      const pages = allDossierPages.filter((p) => p.repoId === repo.id);
      if (pages.length > 0) {
        currentDossiers[repo.slug] = { scopes: this.groupByScope(pages) };
      }
    }

    // Build repos+scopes context: each repo lists distinct scope names from its dossier pages.
    const reposWithScopes = repos.map((r) => {
      const pages = allDossierPages.filter((p) => p.repoId === r.id);
      const scopes = Array.from(new Set(pages.map((p) => p.scope)));
      return { slug: r.slug, name: r.name, scopes };
    });

    const bundle: CompendiumInputBundle = {
      projectId,
      dossierUpdatedId,
      currentCompendium,
      currentDossiers,
      projectMeta: { repos: repos.map((r) => ({ id: r.id, slug: r.slug, name: r.name })) },
      repos: reposWithScopes,
    };

    const json = JSON.stringify(bundle);
    const hash = createHash('sha256').update(json).digest('hex');
    const key = `compendium-jobs/${dossierUpdatedId}-${hash}.json`;
    await this.storageService.putObject(orgSlug, key, Buffer.from(json));
    return { ref: { container: orgSlug, key, hash }, repoSlugs: repos.map((r) => r.slug) };
  }

  async download(ref: BundleRef): Promise<any> {
    const buf = await this.storageService.getObject(ref.container, ref.key);
    return JSON.parse(buf.toString('utf-8'));
  }

  async uploadResult(orgSlug: string, id: string, result: any): Promise<BundleRef> {
    const json = JSON.stringify(result);
    const hash = createHash('sha256').update(json).digest('hex');
    const key = `compendium-jobs/${id}-${hash}.result.json`;
    await this.storageService.putObject(orgSlug, key, Buffer.from(json));
    return { container: orgSlug, key, hash };
  }

  async deleteBoth(inputRef: BundleRef, resultRef: BundleRef): Promise<void> {
    await Promise.allSettled([
      this.storageService.deleteObject(inputRef.container, inputRef.key),
      this.storageService.deleteObject(resultRef.container, resultRef.key),
    ]);
  }

  private groupByScope(pages: DossierPage[]): any[] {
    const map = new Map<string, any[]>();
    for (const p of pages) {
      if (!map.has(p.scope)) map.set(p.scope, []);
      map.get(p.scope)!.push({ slug: p.slug, title: p.title, content: p.content });
    }
    return Array.from(map.entries()).map(([scope, ps]) => ({ scope, pages: ps }));
  }
}
