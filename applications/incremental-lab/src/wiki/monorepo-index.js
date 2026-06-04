/**
 * Hierarchical index for a monorepo wiki.
 *
 * Top-level repo index: groups scopes by kind (Services / Shared Libraries),
 * one link per scope pointing to its own index. Per-scope index lists the
 * fixed 4 pages with one-line descriptions.
 */

import { APP_PAGES } from './app-taxonomy.js';

const KIND_LABEL = {
  app: 'Services',
  lib: 'Shared Libraries',
  root: 'Root',
};

const KIND_ORDER = ['app', 'lib', 'root'];

export function buildRepoIndex({ repoName, scopes, sha, perScopeDescriptions = {} }) {
  const lines = [`# ${repoName} Wiki`, ''];
  if (sha) lines.push(`*sha: ${sha}*`, '');
  const grouped = {};
  for (const s of scopes) (grouped[s.kind] ??= []).push(s);

  for (const kind of KIND_ORDER) {
    const list = grouped[kind];
    if (!list?.length) continue;
    lines.push(`## ${KIND_LABEL[kind] ?? kind}`, '');
    for (const s of list.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const desc = perScopeDescriptions[s.root];
      const descSuffix = desc ? ` — ${desc}` : '';
      lines.push(`- [${s.name}](${s.root.replace(/\//g, '__')}/)${descSuffix}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function buildScopeIndex({ scope, pages, sha }) {
  const lines = [`# ${scope.name}`, ''];
  if (sha) lines.push(`*sha: ${sha}*`, '');
  lines.push('## Pages', '');
  for (const def of APP_PAGES) {
    const body = pages[def.slug] ?? '';
    const oneLine = firstSentence(body) || def.title;
    lines.push(`- [${def.title}](${def.slug}) — ${oneLine}`);
  }
  return lines.join('\n').trimEnd() + '\n';
}

function firstSentence(body) {
  if (!body) return '';
  // skip first heading line, take next non-empty paragraph head
  const lines = body.split('\n');
  const candidates = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('-') || t.startsWith('*')) continue;
    if (t.startsWith('**')) continue;
    candidates.push(t);
    if (candidates.length >= 2) break;
  }
  const text = candidates.join(' ');
  const m = text.match(/^[^.!?]{20,180}[.!?]/);
  if (m) return m[0];
  return text.length > 140 ? text.slice(0, 137) + '...' : text;
}
