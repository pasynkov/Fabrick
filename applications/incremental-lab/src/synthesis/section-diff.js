import { createHash } from 'node:crypto';

const COSMETIC_SECTIONS = new Set([
  '## Related',
  '## Related Pages',
]);

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

/**
 * Parse a wiki markdown body into structured sections.
 *
 * Returns:
 *   {
 *     frontmatter: 'raw frontmatter text or empty',
 *     intro: 'text before first ## header (typically # Title + 1-2 paragraphs)',
 *     sections: { '## Symbols': 'body', '## Notes': 'body', ... }
 *   }
 */
export function parseWikiSections(body) {
  if (!body) return { frontmatter: '', intro: '', sections: {} };

  let rest = body;
  const fmMatch = FRONTMATTER_RE.exec(rest);
  const frontmatter = fmMatch ? fmMatch[1].trim() : '';
  if (fmMatch) rest = rest.slice(fmMatch[0].length);

  const lines = rest.split('\n');
  let intro = [];
  const sections = {};
  let currentHeader = null;
  let currentBody = [];

  const flush = () => {
    if (currentHeader === null) {
      intro = currentBody.slice();
    } else {
      sections[currentHeader] = currentBody.join('\n').trim();
    }
    currentBody = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentHeader = line.trim();
    } else {
      currentBody.push(line);
    }
  }
  flush();

  return {
    frontmatter,
    intro: intro.join('\n').trim(),
    sections,
  };
}

/**
 * Compute hashes for each part of a wiki body.
 * Used to detect section-level changes between snapshots.
 */
export function hashWikiSections(body) {
  const parsed = parseWikiSections(body);
  const out = {
    frontmatter: hash(normalize(parsed.frontmatter)),
    intro: hash(normalize(parsed.intro)),
    sections: {},
  };
  for (const [h, content] of Object.entries(parsed.sections)) {
    out.sections[h] = hash(normalize(content));
  }
  return out;
}

/**
 * Compare two parsed wiki snapshots. Returns which sections changed,
 * filtering out cosmetic sections (Related) and frontmatter-only edits.
 */
export function diffWikiSections(beforeBody, afterBody) {
  const a = hashWikiSections(beforeBody ?? '');
  const b = hashWikiSections(afterBody ?? '');

  const headers = new Set([...Object.keys(a.sections), ...Object.keys(b.sections)]);
  const sectionChanges = [];
  for (const h of headers) {
    const before = a.sections[h];
    const after = b.sections[h];
    if (before === after) continue;
    const kind = before === undefined ? 'added' : after === undefined ? 'deleted' : 'changed';
    sectionChanges.push({ header: h, kind, cosmetic: COSMETIC_SECTIONS.has(h) });
  }

  const introChanged = a.intro !== b.intro;
  const frontmatterChanged = a.frontmatter !== b.frontmatter;

  const significantChanges = sectionChanges.filter((s) => !s.cosmetic);
  const isContentChange = introChanged || significantChanges.length > 0;
  const isCosmeticOnly = !isContentChange && (frontmatterChanged || sectionChanges.length > 0);

  return {
    changedSections: sectionChanges,
    introChanged,
    frontmatterChanged,
    isContentChange,        // body intro or non-Related sections changed
    isCosmeticOnly,         // only Related / frontmatter touched
    isUnchanged: !introChanged && !frontmatterChanged && sectionChanges.length === 0,
  };
}

/**
 * For a list of wiki diffs across a repo, return only the slugs whose
 * content (not just cosmetics) changed.
 */
export function filterContentChanges(beforePages, afterPages) {
  const beforeSlugs = new Set(Object.keys(beforePages));
  const afterSlugs = new Set(Object.keys(afterPages));
  const added = [];
  const changed = [];
  const deleted = [];
  const cosmeticOnly = [];

  for (const slug of afterSlugs) {
    if (!beforeSlugs.has(slug)) {
      added.push({ slug });
      continue;
    }
    if (beforePages[slug] === afterPages[slug]) continue;
    const d = diffWikiSections(beforePages[slug], afterPages[slug]);
    if (d.isUnchanged) continue;
    if (d.isCosmeticOnly) {
      cosmeticOnly.push({ slug, ...d });
    } else {
      changed.push({ slug, sections: d.changedSections.filter((s) => !s.cosmetic).map((s) => s.header) });
    }
  }
  for (const slug of beforeSlugs) if (!afterSlugs.has(slug)) deleted.push(slug);

  return { added, changed, deleted, cosmeticOnly };
}

function hash(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }
function normalize(s) { return (s ?? '').replace(/\s+/g, ' ').trim(); }
