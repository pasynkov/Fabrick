import Parser from 'tree-sitter';
import TS from 'tree-sitter-typescript';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

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

const KIND_MAP = {
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

const LANGUAGE_BY_EXT = {
  '.ts': TS.typescript,
  '.tsx': TS.tsx,
};

export const TS_EXTENSIONS = Object.keys(LANGUAGE_BY_EXT);

export class TypeScriptExtractor {
  constructor() {
    this.parser = new Parser();
  }

  supports(file) {
    const ext = file.slice(file.lastIndexOf('.'));
    return LANGUAGE_BY_EXT[ext] !== undefined;
  }

  setLanguageFor(file) {
    const ext = file.slice(file.lastIndexOf('.'));
    const lang = LANGUAGE_BY_EXT[ext];
    if (!lang) throw new Error(`TypeScriptExtractor cannot handle: ${ext}`);
    this.parser.setLanguage(lang);
  }

  extract(filePath, source) {
    this.setLanguageFor(filePath);
    const tree = this.parser.parse(source);
    const fileImports = collectImports(tree.rootNode, source);
    const symbols = [];
    walkDeclarations(tree.rootNode, source, filePath, fileImports, symbols);
    return symbols;
  }
}

function collectImports(root, source) {
  const imports = [];
  walk(root, (node) => {
    if (node.type === 'import_statement') {
      const src = node.childForFieldName('source');
      if (src) imports.push(stripQuotes(src.text));
    }
  });
  return imports;
}

function walkDeclarations(root, source, file, fileImports, out) {
  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i);
    visitTopLevel(node, source, file, fileImports, out);
  }
}

function visitTopLevel(node, source, file, fileImports, out) {
  if (node.type === 'export_statement') {
    const decorators = node.namedChildren.filter((n) => n.type === 'decorator');
    const inner = node.namedChildren.find((n) => DECLARATION_NODES.has(n.type));
    if (inner) emitDecl(inner, source, file, fileImports, out, true, decorators);
    return;
  }
  if (DECLARATION_NODES.has(node.type)) {
    emitDecl(node, source, file, fileImports, out, false, []);
  }
}

function emitDecl(node, source, file, fileImports, out, exported, externalDecorators = []) {
  if (node.type === 'lexical_declaration') {
    for (const decl of node.namedChildren) {
      if (decl.type !== 'variable_declarator') continue;
      const name = decl.childForFieldName('name');
      if (!name) continue;
      out.push(buildSymbol({
        file,
        kind: 'const',
        name: name.text,
        exported,
        node: decl,
        source,
        fileImports,
      }));
    }
    return;
  }

  const nameNode = node.childForFieldName('name');
  if (!nameNode) return;
  const kind = KIND_MAP[node.type];
  const internalDecorators = node.namedChildren.filter((n) => n.type === 'decorator');
  const decorators = [...externalDecorators, ...internalDecorators];
  const symbol = buildSymbol({
    file,
    kind,
    name: nameNode.text,
    exported,
    node,
    source,
    fileImports,
    decorators,
  });
  out.push(symbol);

  if (node.type === 'class_declaration' || node.type === 'abstract_class_declaration' || node.type === 'interface_declaration') {
    collectMembers(node, source, file, fileImports, symbol.name, out);
  }
}

function collectMembers(classNode, source, file, fileImports, parentName, out) {
  const body = classNode.childForFieldName('body');
  if (!body) return;
  for (const member of body.namedChildren) {
    if (!METHOD_NODES.has(member.type)) continue;
    const nameNode = member.childForFieldName('name');
    if (!nameNode) continue;
    out.push(buildSymbol({
      file,
      kind: KIND_MAP[member.type],
      name: `${parentName}.${nameNode.text}`,
      exported: false,
      node: member,
      source,
      fileImports,
    }));
  }
}

const STRUCTURAL_KINDS = new Set(['interface', 'type', 'enum']);

function buildSymbol({ file, kind, name, exported, node, source, fileImports, decorators = [] }) {
  let signatureSrc;
  let bodyText;
  if (STRUCTURAL_KINDS.has(kind)) {
    signatureSrc = source.slice(node.startIndex, node.endIndex);
    bodyText = '';
  } else {
    const split = splitSignatureAndBody(node, source);
    signatureSrc = split.signature;
    bodyText = split.bodyText;
  }
  const decoratorText = decorators.map((d) => source.slice(d.startIndex, d.endIndex)).join('\n');
  const bodyWithDecorators = decoratorText ? `${decoratorText}\n${bodyText}` : bodyText;
  const refsSet = new Set();
  collectIdentifiers(node, refsSet, name);
  for (const dec of decorators) collectIdentifiers(dec, refsSet, name);
  return {
    id: `${file}::${name}::${kind}`,
    file,
    kind,
    name,
    exported,
    signature: normalizeWhitespace(signatureSrc),
    bodyHash: hash(normalizeBody(bodyWithDecorators)),
    imports: fileImports,
    references: [...refsSet].sort(),
    location: { row: node.startPosition.row + 1, col: node.startPosition.column },
  };
}

function splitSignatureAndBody(node, source) {
  const body = node.childForFieldName('body');
  if (!body) {
    return { signature: source.slice(node.startIndex, node.endIndex), bodyText: '' };
  }
  return {
    signature: source.slice(node.startIndex, body.startIndex),
    bodyText: source.slice(body.startIndex, body.endIndex),
  };
}

function collectReferences(node, source, ownName) {
  const refs = new Set();
  collectIdentifiers(node, refs, ownName);
  return [...refs].sort();
}

function collectIdentifiers(node, refs, ownName) {
  walk(node, (n) => {
    if (n.type === 'identifier' || n.type === 'type_identifier') {
      const text = n.text;
      if (text && text !== ownName && !isLocalDecl(n)) refs.add(text);
    }
  });
}

function isLocalDecl(node) {
  const p = node.parent;
  if (!p) return false;
  if (p.type === 'required_parameter' || p.type === 'optional_parameter') {
    return p.childForFieldName('pattern') === node;
  }
  if (p.type === 'variable_declarator') return p.childForFieldName('name') === node;
  return false;
}

function walk(node, fn) {
  fn(node);
  for (let i = 0; i < node.namedChildCount; i++) walk(node.namedChild(i), fn);
}

function stripQuotes(text) {
  return text.replace(/^['"`]|['"`]$/g, '');
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeBody(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function hash(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}
