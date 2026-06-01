import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PromptRecord, PromptRepository } from '@app/shared';

const PROMPTS_DIR = join(process.cwd(), 'prompts');

function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
}

function makeId(name: string, agent: string, files: Record<string, string>): string {
  const hash = createHash('sha256')
    .update(name + '\n' + agent + '\n' + canonicalJson(files))
    .digest('hex')
    .slice(0, 32);
  // Format as UUID v4-like: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

@Injectable()
export class FilePromptRepository implements PromptRepository {
  async getLatest(name: string, agent: string): Promise<PromptRecord> {
    const promptDir = join(PROMPTS_DIR, name, agent);
    if (!existsSync(promptDir)) {
      throw new Error(`No prompt found for (${name}, ${agent})`);
    }

    const entries = readdirSync(promptDir, { withFileTypes: true });
    const files: Record<string, string> = {};

    for (const entry of entries) {
      if (entry.isFile()) {
        const content = readFileSync(join(promptDir, entry.name), 'utf-8');
        files[entry.name] = content;
      }
    }

    if (Object.keys(files).length === 0) {
      throw new Error(`No prompt files found for (${name}, ${agent})`);
    }

    return {
      id: makeId(name, agent, files),
      name,
      agent,
      revision: 1,
      content: { files },
    };
  }
}
