import { Command, CommandRunner, Option } from 'nest-commander';
import { computeScanResult } from './wiki/hash-scanner';

interface ScanOptions {
  full?: boolean;
}

@Command({ name: 'scan', description: 'Scan source files and output hash diff as JSON', arguments: '[path]' })
export class ScanCommand extends CommandRunner {
  @Option({ flags: '--full', description: 'Force full scan even if hashmap exists' })
  parseFull(): boolean {
    return true;
  }

  async run(passedParams: string[], options: ScanOptions = {}): Promise<void> {
    const rootPath = passedParams[0] ? passedParams[0] : process.cwd();
    const force = options.full ?? false;

    const result = computeScanResult(rootPath, force);

    const output = {
      mode: result.mode,
      changed: result.changed,
      added: result.added,
      deleted: result.deleted,
      totalFiles: result.totalFiles,
    };

    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  }
}
