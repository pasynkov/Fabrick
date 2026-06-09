import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

export interface ScopeState {
  name: string;
  root: string;
  kind: string;
}

export interface FabrickState {
  baselineSha: string | null;
  scopes: ScopeState[];
  lastSyncedAt: string | null;
  lastDossierUpdatedId: string | null;
}

const DEFAULT_STATE: FabrickState = {
  baselineSha: null,
  scopes: [],
  lastSyncedAt: null,
  lastDossierUpdatedId: null,
};

@Injectable()
export class StateService {
  private readonly statePath: string;

  constructor(cwd = process.cwd()) {
    this.statePath = resolve(cwd, '.fabrick', 'state.json');
  }

  getStatePath(): string {
    return this.statePath;
  }

  load(): FabrickState {
    if (!existsSync(this.statePath)) {
      return { ...DEFAULT_STATE };
    }
    try {
      const raw = JSON.parse(readFileSync(this.statePath, 'utf8'));
      return {
        baselineSha: raw.baselineSha ?? null,
        scopes: raw.scopes ?? [],
        lastSyncedAt: raw.lastSyncedAt ?? null,
        lastDossierUpdatedId: raw.lastDossierUpdatedId ?? null,
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  save(state: FabrickState): void {
    const dir = join(this.statePath, '..');
    mkdirSync(dir, { recursive: true });
    const tmp = this.statePath + '.tmp';
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tmp, this.statePath);
  }
}
