import { readFileSync } from 'node:fs';
import { TypeScriptExtractor } from './typescript.js';
import { YamlExtractor } from './yaml.js';

const DEFAULT_EXTRACTORS = [new TypeScriptExtractor(), new YamlExtractor()];

export class Extractor {
  constructor(extractors = DEFAULT_EXTRACTORS) {
    this.extractors = extractors;
  }

  pick(file) {
    return this.extractors.find((e) => e.supports(file)) ?? null;
  }

  extractFromFile(absPath, repoRoot) {
    const source = readFileSync(absPath, 'utf8');
    const relPath = repoRoot ? absPath.slice(repoRoot.length + 1) : absPath;
    return this.extract(relPath, source);
  }

  extract(filePath, source) {
    const ex = this.pick(filePath);
    if (!ex) throw new Error(`No extractor for file: ${filePath}`);
    return ex.extract(filePath, source);
  }
}

export { TypeScriptExtractor, YamlExtractor };
