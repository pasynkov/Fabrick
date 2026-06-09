import { AggregateRoot } from '@nestjs/cqrs';
import { UlidService } from '../event-store/ulid.service';
import { DossierUpdateFired } from './events/dossier-update-fired.event';
import { DossierPatchComputed } from './events/dossier-patch-computed.event';
import { DossierPatchApplied } from './events/dossier-patch-applied.event';
import { DossierPatchDescribed } from './events/dossier-patch-described.event';
import { DossierRegenApplied } from './events/dossier-regen-applied.event';
import { DossierRegenDescribed } from './events/dossier-regen-described.event';
import { DossierScopeRemoved } from './events/dossier-scope-removed.event';
import { DossierUpdated } from './events/dossier-updated.event';

export interface DossierEventInput {
  type: string;
  title?: string;
  bodies?: Record<string, string>;
  instructions?: string;
  meta?: Record<string, unknown>;
}

export interface ScopeEntry {
  scope: string;
  mode: 'patch' | 'regen' | 'delete';
  events: DossierEventInput[];
}

export interface PushUpdatePayload {
  baseSha: string;
  headSha: string;
  prTitle?: string;
  prNumber?: number;
  scopes: ScopeEntry[];
}

export class Dossier extends AggregateRoot {
  private readonly repoId: string;
  private readonly orgId: string;
  private readonly projectId: string;

  constructor(
    repoId: string,
    orgId: string,
    projectId: string,
    private readonly ulidService: UlidService,
  ) {
    super();
    this.repoId = repoId;
    this.orgId = orgId;
    this.projectId = projectId;
  }

  applyPushUpdate(payload: PushUpdatePayload): string {
    const firedId = this.ulidService.generate();

    this.apply(
      new DossierUpdateFired({
        id: firedId,
        orgId: this.orgId,
        projectId: this.projectId,
        repoId: this.repoId,
        baseSha: payload.baseSha,
        headSha: payload.headSha,
        prTitle: payload.prTitle,
        prNumber: payload.prNumber,
      }),
    );

    const scopeSummary: Array<{ name: string; mode: string }> = [];
    let totalCostUsd = 0;

    for (const scopeEntry of payload.scopes) {
      scopeSummary.push({ name: scopeEntry.scope, mode: scopeEntry.mode });

      if (scopeEntry.mode === 'patch') {
        for (const evt of scopeEntry.events) {
          if (evt.type === 'DossierPatchComputed') {
            const meta = (evt.meta || {}) as any;
            totalCostUsd += meta.costUsd || 0;
            this.apply(
              new DossierPatchComputed({
                id: this.ulidService.generate(),
                orgId: this.orgId,
                projectId: this.projectId,
                repoId: this.repoId,
                scope: scopeEntry.scope,
                parentId: firedId,
                instructions: evt.instructions || '',
                meta: {
                  model: meta.model || '',
                  inputTokens: meta.inputTokens || 0,
                  outputTokens: meta.outputTokens || 0,
                  costUsd: meta.costUsd || 0,
                  changedSlugs: meta.changedSlugs || [],
                },
              }),
            );
          } else if (evt.type === 'DossierPatchApplied') {
            const meta = (evt.meta || {}) as any;
            totalCostUsd += meta.costUsd || 0;
            this.apply(
              new DossierPatchApplied({
                id: this.ulidService.generate(),
                orgId: this.orgId,
                projectId: this.projectId,
                repoId: this.repoId,
                scope: scopeEntry.scope,
                parentId: firedId,
                title: evt.title || '',
                bodies: evt.bodies || {},
                meta: {
                  sources: meta.sources || [],
                  slugCounts: meta.slugCounts || {},
                  sample: meta.sample || '',
                  model: meta.model || '',
                  inputTokens: meta.inputTokens || 0,
                  outputTokens: meta.outputTokens || 0,
                  costUsd: meta.costUsd || 0,
                },
              }),
            );
          } else if (evt.type === 'DossierPatchDescribed') {
            const meta = (evt.meta || {}) as any;
            totalCostUsd += meta.costUsd || 0;
            this.apply(
              new DossierPatchDescribed({
                id: this.ulidService.generate(),
                orgId: this.orgId,
                projectId: this.projectId,
                repoId: this.repoId,
                scope: scopeEntry.scope,
                parentId: firedId,
                title: evt.title || '',
                meta: {
                  model: meta.model || '',
                  inputTokens: meta.inputTokens || 0,
                  outputTokens: meta.outputTokens || 0,
                  costUsd: meta.costUsd || 0,
                },
              }),
            );
          }
        }
      } else if (scopeEntry.mode === 'regen') {
        for (const evt of scopeEntry.events) {
          if (evt.type === 'DossierRegenApplied') {
            const meta = (evt.meta || {}) as any;
            totalCostUsd += meta.costUsd || 0;
            this.apply(
              new DossierRegenApplied({
                id: this.ulidService.generate(),
                orgId: this.orgId,
                projectId: this.projectId,
                repoId: this.repoId,
                scope: scopeEntry.scope,
                parentId: firedId,
                bodies: evt.bodies || {},
                meta: {
                  reason: meta.reason || 'auto',
                  sources: meta.sources || [],
                  model: meta.model || '',
                  inputTokens: meta.inputTokens || 0,
                  outputTokens: meta.outputTokens || 0,
                  costUsd: meta.costUsd || 0,
                },
              }),
            );
          } else if (evt.type === 'DossierRegenDescribed') {
            const meta = (evt.meta || {}) as any;
            totalCostUsd += meta.costUsd || 0;
            this.apply(
              new DossierRegenDescribed({
                id: this.ulidService.generate(),
                orgId: this.orgId,
                projectId: this.projectId,
                repoId: this.repoId,
                scope: scopeEntry.scope,
                parentId: firedId,
                title: evt.title || '',
                meta: {
                  model: meta.model || '',
                  inputTokens: meta.inputTokens || 0,
                  outputTokens: meta.outputTokens || 0,
                  costUsd: meta.costUsd || 0,
                },
              }),
            );
          }
        }
      } else if (scopeEntry.mode === 'delete') {
        const meta = (scopeEntry.events[0]?.meta || {}) as any;
        this.apply(
          new DossierScopeRemoved({
            id: this.ulidService.generate(),
            orgId: this.orgId,
            projectId: this.projectId,
            repoId: this.repoId,
            scope: scopeEntry.scope,
            parentId: firedId,
            meta: {
              lastKnownSlugs: meta.lastKnownSlugs || [],
            },
          }),
        );
      }
    }

    const updatedId = this.ulidService.generate();
    this.apply(
      new DossierUpdated({
        id: updatedId,
        orgId: this.orgId,
        projectId: this.projectId,
        repoId: this.repoId,
        parentId: firedId,
        title: payload.prTitle || `${payload.baseSha}..${payload.headSha}`,
        baseSha: payload.baseSha,
        headSha: payload.headSha,
        prNumber: payload.prNumber,
        meta: {
          totalCostUsd,
          scopes: scopeSummary,
        },
      }),
    );

    return updatedId;
  }
}
