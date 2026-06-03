import test from 'node:test';
import assert from 'node:assert/strict';
import { Extractor } from '../../src/extract/extractor.js';

const extractor = new Extractor();

test('extracts function declaration', () => {
  const symbols = extractor.extract('a.ts', `function foo(a: number): string { return String(a); }`);
  assert.equal(symbols.length, 1);
  const fn = symbols[0];
  assert.equal(fn.kind, 'function');
  assert.equal(fn.name, 'foo');
  assert.equal(fn.exported, false);
  assert.match(fn.signature, /function foo\(a: number\): string/);
  assert.ok(fn.bodyHash);
  assert.equal(fn.id, 'a.ts::foo::function');
});

test('marks exported declarations', () => {
  const symbols = extractor.extract('a.ts', `export function foo() {}`);
  assert.equal(symbols[0].exported, true);
});

test('extracts class with methods', () => {
  const code = `
export class Greeter {
  greet(name: string): string { return 'hi ' + name; }
  silent() {}
}`;
  const symbols = extractor.extract('a.ts', code);
  const names = symbols.map((s) => s.name).sort();
  assert.deepEqual(names, ['Greeter', 'Greeter.greet', 'Greeter.silent']);
  const cls = symbols.find((s) => s.kind === 'class');
  assert.equal(cls.exported, true);
});

test('extracts interface and type alias', () => {
  const code = `
export interface User { id: number; email: string; }
export type Status = 'on' | 'off';`;
  const symbols = extractor.extract('a.ts', code);
  const kinds = symbols.map((s) => `${s.kind}:${s.name}`).sort();
  assert.deepEqual(kinds, ['field:User.email', 'field:User.id', 'interface:User', 'type:Status']);
});

test('extracts exported const arrow', () => {
  const symbols = extractor.extract('a.ts', `export const inc = (n: number) => n + 1;`);
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0].kind, 'const');
  assert.equal(symbols[0].name, 'inc');
  assert.equal(symbols[0].exported, true);
});

test('collects file imports', () => {
  const code = `
import { Foo } from './foo';
import Bar from '../bar';
import * as Baz from 'baz';

export class A { use(): Foo { return new Foo(); } }`;
  const symbols = extractor.extract('a.ts', code);
  const cls = symbols.find((s) => s.kind === 'class');
  assert.deepEqual(cls.imports, ['./foo', '../bar', 'baz']);
});

test('collects references inside symbol body', () => {
  const code = `
import { Foo } from './foo';
export function uses(): Foo { return new Foo(); }`;
  const symbols = extractor.extract('a.ts', code);
  const fn = symbols[0];
  assert.ok(fn.references.includes('Foo'));
});

test('bodyHash changes on body edit, stays on whitespace-only edit', () => {
  const a = extractor.extract('a.ts', `function f(){ return 1; }`)[0];
  const b = extractor.extract('a.ts', `function f(){\n  return 1;\n}`)[0];
  const c = extractor.extract('a.ts', `function f(){ return 2; }`)[0];
  assert.equal(a.bodyHash, b.bodyHash, 'whitespace-only edit must not change bodyHash');
  assert.notEqual(a.bodyHash, c.bodyHash, 'semantic edit must change bodyHash');
});

test('signature change is detectable separately from body', () => {
  const a = extractor.extract('a.ts', `function f(x: number){ return x; }`)[0];
  const b = extractor.extract('a.ts', `function f(x: number, y: number){ return x; }`)[0];
  assert.notEqual(a.signature, b.signature);
  assert.equal(a.bodyHash, b.bodyHash);
});

test('stable id format', () => {
  const symbols = extractor.extract('src/foo.ts', `export class Foo { bar() {} }`);
  const ids = symbols.map((s) => s.id).sort();
  assert.deepEqual(ids, [
    'src/foo.ts::Foo.bar::method',
    'src/foo.ts::Foo::class',
  ]);
});

test('decorator content captured in bodyHash and references', () => {
  const a = extractor.extract('m.ts', `@Module({ imports: [Foo, Bar] }) export class M {}`)[0];
  const b = extractor.extract('m.ts', `@Module({ imports: [Foo, Bar, Baz] }) export class M {}`)[0];
  assert.notEqual(a.bodyHash, b.bodyHash, 'decorator change must change bodyHash');
  assert.ok(b.references.includes('Baz'), 'decorator identifiers must appear in references');
});

test('decorator on non-exported class is also captured', () => {
  const s = extractor.extract('m.ts', `@Inject('X') class M {}`)[0];
  assert.ok(s.references.includes('Inject'));
});

test('multiple top-level declarations', () => {
  const code = `
export const A = 1;
export const B = 2;
export function fn() {}`;
  const symbols = extractor.extract('a.ts', code);
  assert.equal(symbols.length, 3);
});
