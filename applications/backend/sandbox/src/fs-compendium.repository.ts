import { Injectable } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { CompendiumRepository, CompendiumPage } from '@app/shared';

const COMPENDIUM_DIR = join(process.cwd(), 'sandbox-data', 'compendium');

@Injectable()
export class FsCompendiumRepository implements CompendiumRepository {
  async findIndex(_projectId: string): Promise<CompendiumPage | null> {
    return this.findBySlug(_projectId, 'index');
  }

  async findBySlug(_projectId: string, slug: string): Promise<CompendiumPage | null> {
    const filePath = join(COMPENDIUM_DIR, `${slug}.md`);
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf-8');
    return { slug, content };
  }

  /** Returns all compendium pages. Not part of the interface but used internally. */
  findAll(): CompendiumPage[] {
    if (!existsSync(COMPENDIUM_DIR)) return [];
    const results: CompendiumPage[] = [];
    for (const entry of readdirSync(COMPENDIUM_DIR, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const slug = entry.name.replace(/\.md$/, '');
        const content = readFileSync(join(COMPENDIUM_DIR, entry.name), 'utf-8');
        results.push({ slug, content });
      }
    }
    return results;
  }
}
