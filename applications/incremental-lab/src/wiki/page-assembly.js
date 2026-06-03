import { pageTitleFor } from './related.js';

export function extractDescription(content) {
  if (!content) return '';
  const noFront = content.replace(/^---[\s\S]*?---\n+/, '');
  const lines = noFront.split('\n');
  let inBody = false;
  const buf = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBody) {
      if (trimmed.startsWith('# ')) { inBody = true; continue; }
      continue;
    }
    if (trimmed.startsWith('#')) break;
    if (!trimmed) {
      if (buf.length) break;
      continue;
    }
    buf.push(trimmed);
  }
  const para = buf.join(' ');
  return para.length > 160 ? para.slice(0, 157) + '...' : para;
}

export function buildFrontmatter({ slug, page, updated }) {
  const lines = ['---', `slug: ${slug.replace(/\.md$/, '')}`];
  if (page?.symbols?.length) {
    lines.push('symbols:');
    for (const id of page.symbols) lines.push(`  - ${id}`);
  }
  if (page?.files?.length) {
    lines.push('files:');
    for (const f of page.files) lines.push(`  - ${f}`);
  }
  if (updated) lines.push(`updated: ${updated}`);
  lines.push('---', '');
  return lines.join('\n');
}

export function buildRelatedSection({ relatedSlugs, sourcemap, snapshot }) {
  if (!relatedSlugs.length) return '';
  const lines = ['## Related', ''];
  for (const targetSlug of relatedSlugs) {
    const title = pageTitleFor(targetSlug, sourcemap, snapshot);
    const href = relativeLink(targetSlug);
    lines.push(`- [${title}](${href})`);
  }
  return '\n' + lines.join('\n') + '\n';
}

function relativeLink(slug) {
  return slug;
}

export function stripRelatedSection(content) {
  return content.replace(/\n*##\s+Related[\s\S]*?(?=\n##\s+|\n*$)/g, '\n').trimEnd() + '\n';
}

export function assemblePage({ slug, body, page, sourcemap, snapshot, relatedSlugs, updated }) {
  const cleanBody = stripRelatedSection(body).trimEnd();
  const front = buildFrontmatter({ slug, page, updated });
  const related = buildRelatedSection({ relatedSlugs, sourcemap, snapshot });
  return `${front}${cleanBody}${related}`.trimEnd() + '\n';
}
