import yaml from 'js-yaml';
import { createHash } from 'node:crypto';

const REFERENCE_KEYS = new Set([
  'configMapRef', 'secretRef', 'serviceName', 'name',
  'targetRef', 'persistentVolumeClaim', 'claimName',
]);

const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

export class YamlExtractor {
  supports(file) {
    const ext = file.slice(file.lastIndexOf('.'));
    return YAML_EXTENSIONS.has(ext);
  }

  extract(filePath, source) {
    let docs;
    try { docs = yaml.loadAll(source); }
    catch { return []; }
    const out = [];
    docs.forEach((doc, idx) => extractDocument(doc, filePath, idx, docs.length, out));
    return out;
  }
}

function extractDocument(doc, filePath, idx, total, out) {
  if (!doc || typeof doc !== 'object') return;
  const kind = doc.kind ?? guessKind(filePath, doc);
  const name = doc.metadata?.name ?? doc.name ?? deriveNameFromPath(filePath, idx, total);
  const id = `${filePath}::${kind}::${name}`;
  const canonical = stableStringify(doc);
  const signature = buildSignature(doc, kind);
  const references = [...collectReferences(doc)].sort();
  out.push({
    id,
    file: filePath,
    kind,
    name,
    exported: true,
    signature,
    bodyHash: hash(canonical),
    imports: [],
    references,
    location: { row: 1, col: 0 },
  });
}

function buildSignature(doc, kind) {
  const parts = [kind];
  if (doc.apiVersion) parts.push(`apiVersion=${doc.apiVersion}`);
  if (doc.metadata?.namespace) parts.push(`ns=${doc.metadata.namespace}`);
  if (doc.spec?.replicas !== undefined) parts.push(`replicas=${doc.spec.replicas}`);
  if (doc.spec?.type) parts.push(`type=${doc.spec.type}`);
  if (Array.isArray(doc.resources)) parts.push(`resources=${doc.resources.length}`);
  return parts.join(' ');
}

function guessKind(filePath, doc) {
  const base = filePath.split('/').pop().toLowerCase();
  if (base.startsWith('kustomization')) return 'Kustomization';
  if (base.includes('deployment')) return 'Deployment';
  if (base.includes('service')) return 'Service';
  if (base.includes('configmap')) return 'ConfigMap';
  if (base.includes('secret')) return 'Secret';
  if (Array.isArray(doc.resources)) return 'Kustomization';
  return 'YamlDoc';
}

function collectReferences(value, out = new Set()) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string') return out;
  if (Array.isArray(value)) {
    for (const v of value) collectReferences(v, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (REFERENCE_KEYS.has(k) && typeof v === 'string') out.add(v);
      else if (REFERENCE_KEYS.has(k) && v && typeof v === 'object' && typeof v.name === 'string') out.add(v.name);
      if (k === 'image' && typeof v === 'string') out.add(v.split(':')[0]);
      if (k === 'resources' && Array.isArray(v)) for (const r of v) if (typeof r === 'string') out.add(r);
      collectReferences(v, out);
    }
  }
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hash(s) { return createHash('sha256').update(s).digest('hex').slice(0, 16); }

function deriveNameFromPath(filePath, idx, total) {
  const dirs = filePath.split('/');
  const lastDir = dirs[dirs.length - 2] ?? 'root';
  return total > 1 ? `${lastDir}-${idx}` : lastDir;
}
