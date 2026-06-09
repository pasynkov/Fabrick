import { Injectable } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface PatchLogScopeEntry {
  name: string;
  mode: string;
  slugCounts: Record<string, { added: number; removed: number; changed: number }>;
  sample: string[];
  description?: string;
}

export interface PatchLogEntry {
  at: string;
  title: string;
  baselineSha: string | null;
  headSha: string;
  costUsd: number;
  scopes: PatchLogScopeEntry[];
}

@Injectable()
export class PatchLogService {
  append(repoPath: string, entry: PatchLogEntry): void {
    const p = join(repoPath, '.fabrick', 'patches.log.jsonl');
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, JSON.stringify(entry) + '\n');
  }
}
