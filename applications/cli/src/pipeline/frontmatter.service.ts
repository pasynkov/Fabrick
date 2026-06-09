import { Injectable } from '@nestjs/common';
import { stringify as yamlStringify, parse as yamlLoad } from 'yaml';

export interface FrontmatterMeta {
  name: string;
  description: string;
  type: 'dossier';
  repo: string;
  scope: string;
  slug: string;
  sha: string;
  updatedAt: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const KEY_ORDER = ['name', 'description', 'type', 'repo', 'scope', 'slug', 'sha', 'updatedAt'];

@Injectable()
export class FrontmatterService {
  stamp(meta: FrontmatterMeta, body: string): string {
    const stripped = this.strip(body);
    const metaObj = meta as unknown as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const k of KEY_ORDER) if (k in metaObj) ordered[k] = metaObj[k];
    for (const k of Object.keys(metaObj)) if (!(k in ordered)) ordered[k] = metaObj[k];
    const fm = yamlStringify(ordered, { lineWidth: 1000 }).trimEnd();
    const head = stripped.startsWith('\n') ? stripped : `\n${stripped}`;
    return `---\n${fm}\n---${head}`;
  }

  strip(body: string): string {
    if (!body) return '';
    const m = body.match(FM_RE);
    if (!m) return body;
    return body.slice(m[0].length);
  }

  parse(body: string): { meta: Record<string, unknown>; content: string } {
    if (!body) return { meta: {}, content: '' };
    const m = body.match(FM_RE);
    if (!m) return { meta: {}, content: body };
    let meta: Record<string, unknown> = {};
    try { meta = (yamlLoad(m[1]) as Record<string, unknown>) ?? {}; } catch {}
    return { meta, content: body.slice(m[0].length) };
  }

  firstSentence(body: string): string {
    const { content } = this.parse(body);
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('-') || t.startsWith('*') || t.startsWith('|') || t.startsWith('```')) continue;
      const stripped = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      const match = stripped.match(/^[^.!?]{20,160}[.!?]/);
      if (match) return match[0];
      return stripped.length > 140 ? stripped.slice(0, 137) + '...' : stripped;
    }
    return '';
  }
}
