/**
 * Extract structural symbols from wiki / synthesis markdown pages so we can
 * diff them at the symbol level instead of the byte level.
 *
 * Symbol kinds produced:
 *   - section      (sectionPath, id)
 *   - bullet       (sectionPath, label, body, links, bodyHash)
 *   - table_row    (sectionPath, key, values, links, bodyHash)
 *
 * Paragraphs are intentionally skipped — they generate noisy diffs and the
 * meaningful facts in our wiki taxonomy live in bullets + table rows.
 */

import { createHash } from 'node:crypto';

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const BULLET_RE = /^(\s*)-\s+(.+)$/;
const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[-:|\s]+\|\s*$/;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const LABEL_PREFIX_RE = /^\*\*([^*]+)\*\*\s*:?/;
const KV_LABEL_RE = /^`?([A-Za-z_][\w./-]*)`?\s*[:=→-]/;
const FENCE_RE = /^```/;

function hash(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }

function stripLinks(s) { return s.replace(LINK_RE, '$1'); }

function extractLinks(s) {
  const out = [];
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(s)) !== null) out.push({ text: m[1], path: m[2] });
  return out;
}

function deriveLabel(body) {
  const first = body.split('\n')[0];
  const m1 = first.match(LABEL_PREFIX_RE);
  if (m1) return m1[1].trim();
  const stripped = stripLinks(first).trim();
  const m2 = stripped.match(KV_LABEL_RE);
  if (m2) return m2[1].trim();
  // fallback: first few words
  return stripped.replace(/[*_`]/g, '').split(/\s+/).slice(0, 5).join(' ').slice(0, 60);
}

/**
 * Extract symbols from a single markdown body (already stripped of frontmatter).
 * `file` is a stable identifier for the page (e.g. "service.md").
 */
export function extractMarkdownSymbols(file, body) {
  const out = [];
  if (!body) return out;
  const lines = body.split('\n');
  let sectionPath = [];
  let inFence = false;
  let pendingTableHeader = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE_RE.test(line)) { inFence = !inFence; i++; continue; }
    if (inFence) { i++; continue; }

    // heading
    const hM = line.match(HEADING_RE);
    if (hM) {
      const level = hM[1].length;
      sectionPath = sectionPath.slice(0, level - 1);
      sectionPath[level - 1] = hM[2].trim();
      while (sectionPath.length && sectionPath[sectionPath.length - 1] === undefined) sectionPath.pop();
      out.push({
        id: `${file}::section::${sectionPath.join('>')}`,
        kind: 'section',
        file,
        sectionPath: [...sectionPath],
        bodyHash: hash(sectionPath.join('>')),
      });
      pendingTableHeader = null;
      i++;
      continue;
    }

    // table header detection: row followed by separator
    if (TABLE_ROW_RE.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      pendingTableHeader = parseTableRow(line);
      i += 2; // skip header + separator
      continue;
    }
    if (pendingTableHeader && TABLE_ROW_RE.test(line)) {
      const cells = parseTableRow(line);
      if (cells.length === 0) { pendingTableHeader = null; i++; continue; }
      const key = stripLinks(cells[0]).trim() || `(row ${i})`;
      const values = {};
      for (let c = 1; c < cells.length && c < pendingTableHeader.length; c++) {
        values[pendingTableHeader[c]] = cells[c];
      }
      const links = extractLinks(line);
      const bodyForHash = key + '|' + Object.values(values).join('|');
      out.push({
        id: `${file}::table::${sectionPath.join('>')}::${key}`,
        kind: 'table_row',
        file,
        sectionPath: [...sectionPath],
        key,
        values,
        links,
        bodyHash: hash(bodyForHash),
      });
      i++;
      continue;
    }
    if (pendingTableHeader && !TABLE_ROW_RE.test(line) && line.trim()) {
      pendingTableHeader = null;
    }

    // bullet
    const bM = line.match(BULLET_RE);
    if (bM) {
      const indent = bM[1].length;
      let body = bM[2];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (!next.trim()) { j++; continue; }
        const nextIndent = (next.match(/^(\s*)/) || ['', ''])[0].length;
        const isAnotherBullet = BULLET_RE.test(next);
        if (nextIndent > indent && !isAnotherBullet) {
          body += '\n' + next;
          j++;
        } else break;
      }
      const label = deriveLabel(body);
      const links = extractLinks(body);
      const trimmed = body.trim();
      out.push({
        id: `${file}::bullet::${sectionPath.join('>')}::${label}`,
        kind: 'bullet',
        file,
        sectionPath: [...sectionPath],
        label,
        body: trimmed,
        links,
        bodyHash: hash(trimmed),
      });
      i = j;
      continue;
    }

    i++;
  }

  return out;
}

function parseTableRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.trim());
}

/**
 * Diff two symbol arrays (returned by extractMarkdownSymbols) at the symbol level.
 * Returns { added, deleted, changed (id, bodyHashBefore→After, linkChanges) }.
 */
export function diffMarkdownSymbols(before, after) {
  const beforeMap = new Map(before.map((s) => [s.id, s]));
  const afterMap = new Map(after.map((s) => [s.id, s]));
  const added = [];
  const deleted = [];
  const changed = [];
  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) { deleted.push(b); continue; }
    if (a.bodyHash !== b.bodyHash) {
      const beforeLinks = new Set((b.links ?? []).map((l) => l.path));
      const afterLinks = new Set((a.links ?? []).map((l) => l.path));
      const linksAdded = [...afterLinks].filter((p) => !beforeLinks.has(p));
      const linksRemoved = [...beforeLinks].filter((p) => !afterLinks.has(p));
      changed.push({ id, kind: a.kind, before: b, after: a, linksAdded, linksRemoved });
    }
  }
  for (const [id, a] of afterMap) {
    if (!beforeMap.has(id)) added.push(a);
  }
  return { added, deleted, changed };
}

/**
 * Compact human-readable rendering of a diff for use in a compute prompt.
 */
export function renderMarkdownDiff(file, diff) {
  const lines = [];
  lines.push(`=== ${file} ===`);
  for (const s of diff.added)   lines.push(`+ ${s.kind} [${s.sectionPath.join(' > ')}] ${labelOf(s)}\n    ${snippet(s).replace(/\n/g, '\n    ')}`);
  for (const s of diff.deleted) lines.push(`- ${s.kind} [${s.sectionPath.join(' > ')}] ${labelOf(s)}\n    ${snippet(s).replace(/\n/g, '\n    ')}`);
  for (const c of diff.changed) {
    lines.push(`~ ${c.kind} [${c.after.sectionPath.join(' > ')}] ${labelOf(c.after)}`);
    lines.push(`    BEFORE:\n      ${snippet(c.before).replace(/\n/g, '\n      ')}`);
    lines.push(`    AFTER:\n      ${snippet(c.after).replace(/\n/g, '\n      ')}`);
    if (c.linksAdded.length)   lines.push(`    +links: ${c.linksAdded.join(', ')}`);
    if (c.linksRemoved.length) lines.push(`    -links: ${c.linksRemoved.join(', ')}`);
  }
  return lines.join('\n');
}

function labelOf(s) {
  if (s.kind === 'section') return s.sectionPath.slice(-1)[0] ?? '';
  if (s.kind === 'bullet') return s.label;
  if (s.kind === 'table_row') return s.key;
  return '';
}

function snippet(s) {
  if (s.kind === 'bullet') return s.body;
  if (s.kind === 'table_row') return `${s.key} | ${Object.values(s.values).join(' | ')}`;
  return '';
}
