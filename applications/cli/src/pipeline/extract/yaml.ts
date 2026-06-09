import { createHash } from 'crypto';
import jsYaml from 'js-yaml';

export interface YamlSymbol {
  id: string;
  file: string;
  kind: string;
  name: string;
  exported: boolean;
  signature: string;
  bodyHash: string;
  imports: string[];
  references: string[];
  location: { row: number; col: number };
}

const REFERENCE_KEYS = new Set([
  'configMapRef', 'secretRef', 'serviceName', 'name',
  'targetRef', 'persistentVolumeClaim', 'claimName',
]);

const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

export class YamlExtractor {
  supports(file: string): boolean {
    const ext = file.slice(file.lastIndexOf('.'));
    return YAML_EXTENSIONS.has(ext);
  }

  extract(filePath: string, source: string): YamlSymbol[] {
    let docs: unknown[];
    try { docs = jsYaml.loadAll(source) as unknown[]; }
    catch { return []; }
    const out: YamlSymbol[] = [];
    docs.forEach((doc, idx) => extractDocument(doc, filePath, idx, docs.length, out));
    return out;
  }
}

function extractDocument(doc: unknown, filePath: string, idx: number, total: number, out: YamlSymbol[]): void {
  if (!doc || typeof doc !== 'object') return;
  const d = doc as Record<string, unknown>;
  const kind = (d.kind as string) ?? guessKind(filePath, d);
  const name = (d.metadata as any)?.name ?? d.name ?? deriveNameFromPath(filePath, idx, total);
  const id = `${filePath}::${kind}::${name}`;
  const canonical = stableStringify(doc);
  const signature = buildSignature(d, kind);
  const references = [...collectReferences(doc)].sort();
  out.push({ id, file: filePath, kind, name: name as string, exported: true, signature, bodyHash: hash(canonical), imports: [], references, location: { row: 1, col: 0 } });
}

function buildSignature(doc: Record<string, unknown>, kind: string): string {
  const parts = [kind];
  if (doc.apiVersion) parts.push(`apiVersion=${doc.apiVersion}`);
  if ((doc.metadata as any)?.namespace) parts.push(`ns=${(doc.metadata as any).namespace}`);
  if ((doc.spec as any)?.replicas !== undefined) parts.push(`replicas=${(doc.spec as any).replicas}`);
  if ((doc.spec as any)?.type) parts.push(`type=${(doc.spec as any).type}`);
  if (Array.isArray(doc.resources)) parts.push(`resources=${(doc.resources as unknown[]).length}`);
  return parts.join(' ');
}

function guessKind(filePath: string, doc: Record<string, unknown>): string {
  const base = filePath.split('/').pop()!.toLowerCase();
  if (base.startsWith('kustomization')) return 'Kustomization';
  if (base.includes('deployment')) return 'Deployment';
  if (base.includes('service')) return 'Service';
  if (base.includes('configmap')) return 'ConfigMap';
  if (base.includes('secret')) return 'Secret';
  if (Array.isArray(doc.resources)) return 'Kustomization';
  return 'YamlDoc';
}

function collectReferences(value: unknown, out = new Set<string>()): Set<string> {
  if (value === null || value === undefined || typeof value === 'string') return out;
  if (Array.isArray(value)) { for (const v of value) collectReferences(v, out); return out; }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as object)) {
      if (REFERENCE_KEYS.has(k) && typeof v === 'string') out.add(v);
      else if (REFERENCE_KEYS.has(k) && v && typeof v === 'object' && typeof (v as any).name === 'string') out.add((v as any).name);
      if (k === 'image' && typeof v === 'string') out.add((v as string).split(':')[0]);
      if (k === 'resources' && Array.isArray(v)) for (const r of v as unknown[]) if (typeof r === 'string') out.add(r);
      collectReferences(v, out);
    }
  }
  return out;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + (value as unknown[]).map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hash(s: string): string { return createHash('sha256').update(s).digest('hex').slice(0, 16); }

function deriveNameFromPath(filePath: string, idx: number, total: number): string {
  const dirs = filePath.split('/');
  const lastDir = dirs[dirs.length - 2] ?? 'root';
  return total > 1 ? `${lastDir}-${idx}` : lastDir;
}
