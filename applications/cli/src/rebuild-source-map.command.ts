import { Command, CommandRunner, Option } from 'nest-commander';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildSourceMap, writeSourceMap } from './wiki/source-map';
import { scanFiles } from './wiki/hash-scanner';

interface RebuildOptions {
  wikiPath?: string;
}

@Command({ name: 'rebuild-source-map', description: 'Rebuild source-map.json and hashmap.json after wiki generation' })
export class RebuildSourceMapCommand extends CommandRunner {
  @Option({ flags: '--wiki-path <path>', description: 'Path to wiki directory (default: .fabrick/wiki/)' })
  parseWikiPath(val: string): string {
    return val;
  }

  async run(_passedParams: string[], options: RebuildOptions = {}): Promise<void> {
    const cwd = process.cwd();
    const wikiPath = options.wikiPath
      ? join(cwd, options.wikiPath)
      : join(cwd, '.fabrick', 'wiki');

    console.error(`Rebuilding source map at ${wikiPath}...`);

    // Build source map from wiki page frontmatter
    const sourceMap = buildSourceMap(wikiPath);
    writeSourceMap(wikiPath, sourceMap);
    const sourceCount = Object.keys(sourceMap).length;
    console.error(`✓ source-map.json: ${sourceCount} source files mapped`);

    // Re-scan source files and write new hashmap
    const hashmap = scanFiles(cwd);
    mkdirSync(wikiPath, { recursive: true });
    writeFileSync(join(wikiPath, 'hashmap.json'), JSON.stringify(hashmap, null, 2), 'utf-8');
    console.error(`✓ hashmap.json: ${Object.keys(hashmap).length} files hashed`);
  }
}
