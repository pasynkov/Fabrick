import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

interface WikiFrontmatter {
  slug?: string;
  sources?: string[];
}

function parseFrontmatter(content: string): WikiFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: WikiFrontmatter = {};

  // Parse slug
  const slugMatch = yaml.match(/^slug:\s*(.+)$/m);
  if (slugMatch) result.slug = slugMatch[1].trim();

  // Parse sources array (multi-line YAML list)
  const sourcesMatch = yaml.match(/^sources:\s*\n((?:\s+-\s+.+\n?)*)/m);
  if (sourcesMatch) {
    result.sources = sourcesMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim());
  } else {
    // Inline list: sources: [a, b]
    const inlineMatch = yaml.match(/^sources:\s*\[([^\]]*)\]/m);
    if (inlineMatch) {
      result.sources = inlineMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return result;
}

function walkMarkdownFiles(dir: string, results: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkMarkdownFiles(fullPath, results);
    } else if (stat.isFile() && entry.endsWith('.md') && entry !== 'index.md') {
      results.push(fullPath);
    }
  }
}

export function buildSourceMap(wikiPath: string): Record<string, string[]> {
  const mdFiles: string[] = [];
  walkMarkdownFiles(wikiPath, mdFiles);

  const sourceMap: Record<string, string[]> = {};

  for (const filePath of mdFiles) {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter.slug || !frontmatter.sources?.length) continue;

    for (const source of frontmatter.sources) {
      if (!sourceMap[source]) sourceMap[source] = [];
      if (!sourceMap[source].includes(frontmatter.slug)) {
        sourceMap[source].push(frontmatter.slug);
      }
    }
  }

  return sourceMap;
}

export function writeSourceMap(wikiPath: string, sourceMap: Record<string, string[]>): void {
  if (!existsSync(wikiPath)) mkdirSync(wikiPath, { recursive: true });
  writeFileSync(join(wikiPath, 'source-map.json'), JSON.stringify(sourceMap, null, 2), 'utf-8');
}

export function readSourceMap(wikiPath: string): Record<string, string[]> {
  const smPath = join(wikiPath, 'source-map.json');
  if (!existsSync(smPath)) return {};
  try {
    return JSON.parse(readFileSync(smPath, 'utf-8'));
  } catch {
    return {};
  }
}
