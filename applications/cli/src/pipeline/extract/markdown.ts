import { createHash } from 'crypto';

export interface MarkdownSymbol {
  id: string;
  kind: 'section' | 'bullet' | 'table_row';
  file: string;
  sectionPath: string[];
  bodyHash: string;
  fingerprintHash?: string;
  // bullet-specific
  label?: string;
  body?: string;
  links?: Array<{ text: string; path: string }>;
  // table_row-specific
  key?: string;
  values?: Record<string, string>;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const BULLET_RE = /^(\s*)-\s+(.+)$/;
const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[-:|\s]+\|\s*$/;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const LABEL_PREFIX_RE = /^\*\*([^*]+)\*\*\s*:?/;
const KV_LABEL_RE = /^`?([A-Za-z_][\w./-]*)`?\s*[:=→-]/;
const FENCE_RE = /^```/;

function hash(s: string): string { return createHash('sha256').update(s).digest('hex').slice(0, 16); }

function stripLinks(s: string): string { return s.replace(LINK_RE, '$1'); }

function extractLinks(s: string): Array<{ text: string; path: string }> {
  const out: Array<{ text: string; path: string }> = [];
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(s)) !== null) out.push({ text: m[1], path: m[2] });
  return out;
}

function deriveLabel(body: string): string {
  const first = body.split('\n')[0];
  const m1 = first.match(LABEL_PREFIX_RE);
  if (m1) return m1[1].trim();
  const stripped = stripLinks(first).trim();
  const m2 = stripped.match(KV_LABEL_RE);
  if (m2) return m2[1].trim();
  return stripped.replace(/[*_`]/g, '').split(/\s+/).slice(0, 5).join(' ').slice(0, 60);
}

export function extractMarkdownSymbols(file: string, body: string): MarkdownSymbol[] {
  const out: MarkdownSymbol[] = [];
  if (!body) return out;
  const lines = body.split('\n');
  let sectionPath: string[] = [];
  let inFence = false;
  let pendingTableHeader: string[] | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (FENCE_RE.test(line)) { inFence = !inFence; i++; continue; }
    if (inFence) { i++; continue; }

    const hM = line.match(HEADING_RE);
    if (hM) {
      const level = hM[1].length;
      sectionPath = sectionPath.slice(0, level - 1);
      sectionPath[level - 1] = hM[2].trim();
      while (sectionPath.length && sectionPath[sectionPath.length - 1] === undefined) sectionPath.pop();
      out.push({ id: `${file}::section::${sectionPath.join('>')}`, kind: 'section', file, sectionPath: [...sectionPath], bodyHash: hash(sectionPath.join('>')) });
      pendingTableHeader = null;
      i++;
      continue;
    }

    if (TABLE_ROW_RE.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      pendingTableHeader = parseTableRow(line);
      i += 2;
      continue;
    }
    if (pendingTableHeader && TABLE_ROW_RE.test(line)) {
      const cells = parseTableRow(line);
      if (cells.length === 0) { pendingTableHeader = null; i++; continue; }
      const key = stripLinks(cells[0]).trim() || `(row ${i})`;
      const values: Record<string, string> = {};
      for (let c = 1; c < cells.length && c < pendingTableHeader.length; c++) {
        values[pendingTableHeader[c]] = cells[c];
      }
      const links = extractLinks(line);
      const bodyForHash = key + '|' + Object.values(values).join('|');
      const fingerprintHash = hash([key, ...links.map((l) => l.path).sort()].join('|'));
      out.push({ id: `${file}::table::${sectionPath.join('>')}::${key}`, kind: 'table_row', file, sectionPath: [...sectionPath], key, values, links, bodyHash: hash(bodyForHash), fingerprintHash });
      i++;
      continue;
    }
    if (pendingTableHeader && !TABLE_ROW_RE.test(line) && line.trim()) pendingTableHeader = null;

    const bM = line.match(BULLET_RE);
    if (bM) {
      const indent = bM[1].length;
      let bulletBody = bM[2];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (!next.trim()) { j++; continue; }
        const nextIndent = (next.match(/^(\s*)/) || ['', ''])[1].length;
        const isAnotherBullet = BULLET_RE.test(next);
        if (nextIndent > indent && !isAnotherBullet) { bulletBody += '\n' + next; j++; } else break;
      }
      const label = deriveLabel(bulletBody);
      const links = extractLinks(bulletBody);
      const trimmed = bulletBody.trim();
      const fingerprintHash = hash([label, ...links.map((l) => l.path).sort()].join('|'));
      out.push({ id: `${file}::bullet::${sectionPath.join('>')}::${label}`, kind: 'bullet', file, sectionPath: [...sectionPath], label, body: trimmed, links, bodyHash: hash(trimmed), fingerprintHash });
      i = j;
      continue;
    }
    i++;
  }
  return out;
}

function parseTableRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.trim());
}

export function diffMarkdownFingerprints(before: MarkdownSymbol[], after: MarkdownSymbol[]): {
  added: MarkdownSymbol[]; deleted: MarkdownSymbol[]; changed: Array<{ id: string; kind: string; before: MarkdownSymbol; after: MarkdownSymbol }>;
} {
  const beforeMap = new Map(before.map((s) => [s.id, s]));
  const afterMap = new Map(after.map((s) => [s.id, s]));
  const added: MarkdownSymbol[] = [];
  const deleted: MarkdownSymbol[] = [];
  const changed: Array<{ id: string; kind: string; before: MarkdownSymbol; after: MarkdownSymbol }> = [];
  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) { deleted.push(b); continue; }
    if (a.fingerprintHash !== b.fingerprintHash) changed.push({ id, kind: a.kind, before: b, after: a });
  }
  for (const [id, a] of afterMap) if (!beforeMap.has(id)) added.push(a);
  return { added, deleted, changed };
}

export function renderMarkdownDiff(file: string, diff: { added: MarkdownSymbol[]; deleted: MarkdownSymbol[]; changed: Array<{ id: string; kind: string; before: MarkdownSymbol; after: MarkdownSymbol }> }): string {
  const lines: string[] = [];
  lines.push(`=== ${file} ===`);
  for (const s of diff.added)   lines.push(`+ ${s.kind} [${s.sectionPath.join(' > ')}] ${labelOf(s)}\n    ${snippetOf(s).replace(/\n/g, '\n    ')}`);
  for (const s of diff.deleted) lines.push(`- ${s.kind} [${s.sectionPath.join(' > ')}] ${labelOf(s)}\n    ${snippetOf(s).replace(/\n/g, '\n    ')}`);
  for (const c of diff.changed) {
    lines.push(`~ ${c.kind} [${c.after.sectionPath.join(' > ')}] ${labelOf(c.after)}`);
    lines.push(`    BEFORE:\n      ${snippetOf(c.before).replace(/\n/g, '\n      ')}`);
    lines.push(`    AFTER:\n      ${snippetOf(c.after).replace(/\n/g, '\n      ')}`);
  }
  return lines.join('\n');
}

function labelOf(s: MarkdownSymbol): string {
  if (s.kind === 'section') return s.sectionPath.slice(-1)[0] ?? '';
  if (s.kind === 'bullet') return s.label ?? '';
  if (s.kind === 'table_row') return s.key ?? '';
  return '';
}

function snippetOf(s: MarkdownSymbol): string {
  if (s.kind === 'bullet') return s.body ?? '';
  if (s.kind === 'table_row') return `${s.key} | ${Object.values(s.values ?? {}).join(' | ')}`;
  return '';
}
