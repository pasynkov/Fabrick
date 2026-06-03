import { extractDescription } from './page-assembly.js';
import { pageTitleFor } from './related.js';

const CATEGORY_LABEL = {
  entities: 'Entities',
  logic: 'Logic',
  types: 'Types',
  enums: 'Enums',
  consts: 'Constants',
  misc: 'Other',
};

export function buildIndex({ sourcemap, snapshot, pages, updated }) {
  const groups = {};
  for (const slug of Object.keys(sourcemap.pages ?? {})) {
    if (slug === 'index.md') continue;
    const dir = slug.includes('/') ? slug.slice(0, slug.indexOf('/')) : 'misc';
    if (!groups[dir]) groups[dir] = [];
    const content = pages.get(slug) ?? '';
    groups[dir].push({
      slug,
      title: pageTitleFor(slug, sourcemap, snapshot),
      desc: extractDescription(content),
    });
  }

  const lines = ['# Wiki Index', ''];
  if (updated) lines.push(`*updated: ${updated}*`, '');

  const orderedDirs = Object.keys(groups).sort((a, b) => {
    const ai = orderHint(a); const bi = orderHint(b);
    if (ai !== bi) return ai - bi;
    return a < b ? -1 : 1;
  });

  for (const dir of orderedDirs) {
    lines.push(`## ${CATEGORY_LABEL[dir] ?? capitalize(dir)}`, '');
    const items = groups[dir].sort((a, b) => (a.title < b.title ? -1 : 1));
    for (const it of items) {
      const descSuffix = it.desc ? ` — ${it.desc}` : '';
      lines.push(`- [${it.title}](${it.slug})${descSuffix}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function orderHint(dir) {
  const order = ['entities', 'types', 'enums', 'consts', 'logic', 'misc'];
  const i = order.indexOf(dir);
  return i < 0 ? order.length : i;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
