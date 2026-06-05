/**
 * Apply routing rules (from bootstrap) to a snapshot's files. Produces a
 * file→[slug] map: which wiki page(s) each source file documents.
 *
 * Deterministic, no LLM. Combines three signal sources per file:
 *   1. filePatterns — glob patterns over the file path
 *   2. decorators   — decorators present in the file's symbols
 *   3. imports      — imports declared in the file (per-slug or integration map)
 */

const SLUGS = ['service', 'contracts', 'config', 'integrations'];

// Glob → regex. Supports:
//   *   matches any chars except '/'
//   **  matches any chars including '/'
//   patterns without '/' are treated as basename matches (anywhere in the tree)
function globToRegex(glob) {
  const pattern = glob.includes('/') ? glob : `**/${glob}`;
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
        if (pattern[i + 1] === '/') i++;
        out += '(?:/)?';
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

function compileFilePatterns(rules) {
  const out = [];
  for (const [pattern, slugs] of Object.entries(rules.filePatterns ?? {})) {
    out.push({ re: globToRegex(pattern), slugs: Array.isArray(slugs) ? slugs : [slugs] });
  }
  return out;
}

function decoratorSlug(rules) {
  const out = {};
  for (const slug of SLUGS) {
    for (const dec of rules.decorators?.[slug] ?? []) out[dec] = slug;
  }
  return out;
}

function importSlug(rules) {
  const out = {};
  const imports = rules.imports ?? {};
  for (const slug of SLUGS) {
    const entry = imports[slug];
    if (!entry) continue;
    if (Array.isArray(entry)) for (const p of entry) out[p] = slug;
    else if (typeof entry === 'object') for (const p of Object.keys(entry)) out[p] = slug;
  }
  return out;
}

const DECORATOR_RE = /@([A-Z]\w*)/g;

function groupByFile(snapshot) {
  const byFile = {};
  for (const s of snapshot.symbols) (byFile[s.file] ??= []).push(s);
  return byFile;
}

export function buildFileSlugMap(snapshot, rules) {
  const filePatterns = compileFilePatterns(rules);
  const decMap = decoratorSlug(rules);
  const impMap = importSlug(rules);
  const internalLibs = rules.internalLibs ?? [];
  const byFile = groupByFile(snapshot);
  const fileSlug = {};

  for (const file of Object.keys(snapshot.files).sort()) {
    const slugs = new Set();
    const evidence = [];

    for (const { re, slugs: targets } of filePatterns) {
      if (re.test(file)) {
        for (const slug of targets) slugs.add(slug);
        evidence.push(`pattern:${targets.join('|')}`);
        break;
      }
    }

    const symbols = byFile[file] ?? [];

    for (const s of symbols) {
      let m;
      DECORATOR_RE.lastIndex = 0;
      while ((m = DECORATOR_RE.exec(s.signature ?? '')) !== null) {
        const slug = decMap[m[1]];
        if (slug) {
          slugs.add(slug);
          evidence.push(`@${m[1]}→${slug}`);
        }
      }
    }

    const imports = symbols[0]?.imports ?? [];
    for (const imp of imports) {
      if (internalLibs.some((lib) => imp.startsWith(lib))) continue;
      const slug = impMap[imp];
      if (slug) {
        slugs.add(slug);
        evidence.push(`import:${imp}→${slug}`);
      }
    }

    fileSlug[file] = { slugs: [...slugs].sort(), evidence: [...new Set(evidence)].slice(0, 6) };
  }

  return fileSlug;
}

export function invertSlugMap(fileSlug) {
  const out = {};
  for (const slug of SLUGS) out[slug] = [];
  for (const [file, entry] of Object.entries(fileSlug)) {
    for (const slug of entry.slugs) (out[slug] ??= []).push(file);
  }
  for (const slug of Object.keys(out)) out[slug].sort();
  return out;
}
