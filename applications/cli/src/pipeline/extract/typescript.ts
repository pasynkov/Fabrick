import { createHash } from 'crypto';

// tree-sitter types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parser = require('tree-sitter');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TS = require('tree-sitter-typescript');

export interface Symbol {
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

const DECLARATION_NODES = new Set([
  'class_declaration',
  'abstract_class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'function_declaration',
  'lexical_declaration',
]);

const METHOD_NODES = new Set([
  'method_definition',
  'public_field_definition',
  'method_signature',
  'property_signature',
]);

const KIND_MAP: Record<string, string> = {
  class_declaration: 'class',
  abstract_class_declaration: 'class',
  interface_declaration: 'interface',
  type_alias_declaration: 'type',
  enum_declaration: 'enum',
  function_declaration: 'function',
  method_definition: 'method',
  public_field_definition: 'field',
  method_signature: 'method',
  property_signature: 'field',
};

const LANGUAGE_BY_EXT: Record<string, unknown> = {
  '.ts': TS.typescript,
  '.tsx': TS.tsx,
};

export const TS_EXTENSIONS = Object.keys(LANGUAGE_BY_EXT);

export class TypeScriptExtractor {
  private parser: any;

  constructor() {
    this.parser = new Parser();
  }

  supports(file: string): boolean {
    const ext = file.slice(file.lastIndexOf('.'));
    return LANGUAGE_BY_EXT[ext] !== undefined;
  }

  setLanguageFor(file: string): void {
    const ext = file.slice(file.lastIndexOf('.'));
    const lang = LANGUAGE_BY_EXT[ext];
    if (!lang) throw new Error(`TypeScriptExtractor cannot handle: ${ext}`);
    this.parser.setLanguage(lang);
  }

  extract(filePath: string, source: string): Symbol[] {
    this.setLanguageFor(filePath);
    const tree = this.parser.parse(source);
    const fileImports = collectImports(tree.rootNode, source);
    const symbols: Symbol[] = [];
    walkDeclarations(tree.rootNode, source, filePath, fileImports, symbols);
    return symbols;
  }
}

function collectImports(root: any, source: string): string[] {
  const imports: string[] = [];
  walk(root, (node: any) => {
    if (node.type === 'import_statement') {
      const src = node.childForFieldName('source');
      if (src) imports.push(stripQuotes(src.text));
    }
  });
  return imports;
}

function walkDeclarations(root: any, source: string, file: string, fileImports: string[], out: Symbol[]): void {
  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i);
    visitTopLevel(node, source, file, fileImports, out);
  }
}

function visitTopLevel(node: any, source: string, file: string, fileImports: string[], out: Symbol[]): void {
  if (node.type === 'export_statement') {
    const decorators = node.namedChildren.filter((n: any) => n.type === 'decorator');
    const inner = node.namedChildren.find((n: any) => DECLARATION_NODES.has(n.type));
    if (inner) emitDecl(inner, source, file, fileImports, out, true, decorators);
    return;
  }
  if (DECLARATION_NODES.has(node.type)) {
    emitDecl(node, source, file, fileImports, out, false, []);
  }
}

function emitDecl(node: any, source: string, file: string, fileImports: string[], out: Symbol[], exported: boolean, externalDecorators: any[] = []): void {
  if (node.type === 'lexical_declaration') {
    for (const decl of node.namedChildren) {
      if (decl.type !== 'variable_declarator') continue;
      const name = decl.childForFieldName('name');
      if (!name) continue;
      out.push(buildSymbol({ file, kind: 'const', name: name.text, exported, node: decl, source, fileImports }));
    }
    return;
  }

  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;
  const kind = KIND_MAP[node.type];
  const internalDecorators = node.namedChildren.filter((n: any) => n.type === 'decorator');
  const decorators = [...externalDecorators, ...internalDecorators];
  const symbol = buildSymbol({ file, kind, name: nameNode.text, exported, node, source, fileImports, decorators });
  out.push(symbol);

  if (node.type === 'class_declaration' || node.type === 'abstract_class_declaration' || node.type === 'interface_declaration') {
    collectMembers(node, source, file, fileImports, symbol.name, out);
  }
}

function collectMembers(classNode: any, source: string, file: string, fileImports: string[], parentName: string, out: Symbol[]): void {
  const body = classNode.childForFieldName('body');
  if (!body) return;
  let pendingDecorators: any[] = [];
  for (const member of body.namedChildren) {
    if (member.type === 'decorator') { pendingDecorators.push(member); continue; }
    if (!METHOD_NODES.has(member.type)) { pendingDecorators = []; continue; }
    const nameNode = member.childForFieldName('name');
    if (!nameNode) { pendingDecorators = []; continue; }
    out.push(buildSymbol({ file, kind: KIND_MAP[member.type], name: `${parentName}.${nameNode.text}`, exported: false, node: member, source, fileImports, decorators: pendingDecorators }));
    pendingDecorators = [];
  }
}

const STRUCTURAL_KINDS = new Set(['interface', 'type', 'enum']);

function buildSymbol({ file, kind, name, exported, node, source, fileImports, decorators = [] }: {
  file: string; kind: string; name: string; exported: boolean; node: any; source: string; fileImports: string[]; decorators?: any[];
}): Symbol {
  let signatureSrc: string;
  let bodyText: string;
  if (STRUCTURAL_KINDS.has(kind)) {
    signatureSrc = source.slice(node.startIndex, node.endIndex);
    bodyText = '';
  } else {
    const split = splitSignatureAndBody(node, source);
    signatureSrc = split.signature;
    bodyText = split.bodyText;
  }
  const decoratorText = decorators.map((d: any) => source.slice(d.startIndex, d.endIndex)).join('\n');
  const bodyWithDecorators = decoratorText ? `${decoratorText}\n${bodyText}` : bodyText;
  const signatureWithDecorators = decoratorText ? `${decoratorText}\n${signatureSrc}` : signatureSrc;
  const refsSet = new Set<string>();
  collectIdentifiers(node, refsSet, name);
  for (const dec of decorators) collectIdentifiers(dec, refsSet, name);
  return {
    id: `${file}::${name}::${kind}`,
    file,
    kind,
    name,
    exported,
    signature: normalizeWhitespace(signatureWithDecorators),
    bodyHash: hash(normalizeBody(bodyWithDecorators)),
    imports: fileImports,
    references: [...refsSet].sort(),
    location: { row: node.startPosition.row + 1, col: node.startPosition.column },
  };
}

function splitSignatureAndBody(node: any, source: string): { signature: string; bodyText: string } {
  const body = node.childForFieldName('body');
  if (!body) return { signature: source.slice(node.startIndex, node.endIndex), bodyText: '' };
  return { signature: source.slice(node.startIndex, body.startIndex), bodyText: source.slice(body.startIndex, body.endIndex) };
}

function collectIdentifiers(node: any, refs: Set<string>, ownName: string): void {
  walk(node, (n: any) => {
    if (n.type === 'identifier' || n.type === 'type_identifier') {
      const text = n.text;
      if (text && text !== ownName && !isLocalDecl(n)) refs.add(text);
    }
  });
}

function isLocalDecl(node: any): boolean {
  const p = node.parent;
  if (!p) return false;
  if (p.type === 'required_parameter' || p.type === 'optional_parameter') {
    return p.childForFieldName('pattern') === node;
  }
  if (p.type === 'variable_declarator') return p.childForFieldName('name') === node;
  return false;
}

function walk(node: any, fn: (n: any) => void): void {
  fn(node);
  for (let i = 0; i < node.namedChildCount; i++) walk(node.namedChild(i), fn);
}

function stripQuotes(text: string): string { return text.replace(/^['"`]|['"`]$/g, ''); }
function normalizeWhitespace(s: string): string { return s.replace(/\s+/g, ' ').trim(); }
function normalizeBody(s: string): string { return s.replace(/\s+/g, ' ').trim(); }
function hash(s: string): string { return createHash('sha256').update(s).digest('hex').slice(0, 16); }
