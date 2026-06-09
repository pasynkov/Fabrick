import { CompendiumResultBundle } from '../compendium.aggregate';
import { BundleRef } from '../services/compendium-bundle.service';

export class ProcessCompendiumResultCommand {
  constructor(
    public readonly jobId: string,
    public readonly projectId: string,
    public readonly orgId: string,
    public readonly result: CompendiumResultBundle,
    public readonly inputRef: BundleRef,
    public readonly resultRef: BundleRef,
  ) {}
}
