import { AggregateRoot } from '@nestjs/cqrs';
import { UlidService } from '../event-store/ulid.service';
import { CompendiumRegenFired } from './events/compendium-regen-fired.event';
import { CompendiumPatchComputed } from './events/compendium-patch-computed.event';
import { CompendiumRegenApplied } from './events/compendium-regen-applied.event';
import { CompendiumDescribed } from './events/compendium-described.event';
import { CompendiumUpdated } from './events/compendium-updated.event';

export interface CompendiumResultBundle {
  jobId: string;
  patchComputed: {
    instructions: string;
    meta: { model: string; inputTokens: number; outputTokens: number; costUsd: number };
  };
  regenApplied: {
    bodies: Record<string, string>;
    meta: { model: string; inputTokens: number; outputTokens: number; costUsd: number };
  };
  described: {
    title: string;
    meta: { model: string; inputTokens: number; outputTokens: number; costUsd: number };
  };
  finalCompendium: {
    pages: Array<{ slug: string; title: string; content: string; sources: string[]; related: string[] }>;
  };
}

export class Compendium extends AggregateRoot {
  private readonly projectId: string;
  private readonly orgId: string;

  constructor(
    projectId: string,
    orgId: string,
    private readonly ulidService: UlidService,
  ) {
    super();
    this.projectId = projectId;
    this.orgId = orgId;
  }

  fireRegen(
    dossierUpdatedId: string,
    bundleRef: { container: string; key: string; hash: string },
    repos: string[],
  ): void {
    this.apply(
      new CompendiumRegenFired({
        id: this.ulidService.generate(),
        orgId: this.orgId,
        projectId: this.projectId,
        parentId: dossierUpdatedId,
        bundleRef,
        repos,
        dossierUpdatedId,
      }),
    );
  }

  acceptResult(jobId: string, result: CompendiumResultBundle): string {
    const patchComputedId = this.ulidService.generate();
    const regenAppliedId = this.ulidService.generate();
    const describedId = this.ulidService.generate();
    const updatedId = this.ulidService.generate();

    this.apply(
      new CompendiumPatchComputed({
        id: patchComputedId,
        orgId: this.orgId,
        projectId: this.projectId,
        parentId: jobId,
        instructions: result.patchComputed.instructions,
        meta: result.patchComputed.meta,
      }),
    );

    this.apply(
      new CompendiumRegenApplied({
        id: regenAppliedId,
        orgId: this.orgId,
        projectId: this.projectId,
        parentId: jobId,
        bodies: result.regenApplied.bodies,
        meta: result.regenApplied.meta,
      }),
    );

    this.apply(
      new CompendiumDescribed({
        id: describedId,
        orgId: this.orgId,
        projectId: this.projectId,
        parentId: jobId,
        title: result.described.title,
        meta: result.described.meta,
      }),
    );

    const totalCostUsd =
      result.patchComputed.meta.costUsd +
      result.regenApplied.meta.costUsd +
      result.described.meta.costUsd;

    this.apply(
      new CompendiumUpdated({
        id: updatedId,
        orgId: this.orgId,
        projectId: this.projectId,
        parentId: describedId,
        title: result.described.title,
        meta: {
          repos: [],
          totalCostUsd,
        },
      }),
    );

    return updatedId;
  }
}
