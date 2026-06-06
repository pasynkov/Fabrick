/**
 * YAML frontmatter for wiki + synthesis pages. Stamped deterministically by
 * the CLI — the LLM does not see (or write) frontmatter. Pages start with:
 *
 *   ---
 *   name: <scope-name> — <Title>
 *   description: <one-line summary>
 *   type: wiki | synthesis
 *   repo / scope / slug / system / sha …
 *   ---
 *   # Body…
 */

import yaml from 'js-yaml';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function stripFrontmatter(body) {
  if (!body) return { meta: {}, content: '' };
  const m = body.match(FM_RE);
  if (!m) return { meta: {}, content: body };
  let meta = {};
  try { meta = yaml.load(m[1]) ?? {}; } catch {}
  return { meta, content: body.slice(m[0].length) };
}

export function buildFrontmatter(meta) {
  const ordered = orderKeys(meta);
  return yaml.dump(ordered, { lineWidth: 1000, noRefs: true, sortKeys: false }).trimEnd();
}

export function stampFrontmatter(meta, body) {
  const stripped = stripFrontmatter(body).content;
  const head = stripped.startsWith('\n') ? stripped : `\n${stripped}`;
  return `---\n${buildFrontmatter(meta)}\n---${head}`;
}

function orderKeys(meta) {
  const order = ['name', 'description', 'type', 'system', 'repo', 'scope', 'slug', 'sha', 'updatedAt'];
  const out = {};
  for (const k of order) if (k in meta) out[k] = meta[k];
  for (const k of Object.keys(meta)) if (!(k in out)) out[k] = meta[k];
  return out;
}

/**
 * Extract a 1-line description from a wiki/synthesis body. Skips the H1
 * heading and frontmatter; takes the first prose sentence, max 160 chars.
 */
export function firstSentence(body) {
  if (!body) return '';
  const { content } = stripFrontmatter(body);
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('-') || t.startsWith('*') || t.startsWith('|') || t.startsWith('```')) continue;
    const stripped = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const m = stripped.match(/^[^.!?]{20,160}[.!?]/);
    if (m) return m[0];
    return stripped.length > 140 ? stripped.slice(0, 137) + '...' : stripped;
  }
  return '';
}
