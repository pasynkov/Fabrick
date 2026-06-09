import { extractMarkdownSymbols, diffMarkdownFingerprints } from './markdown';

describe('extractMarkdownSymbols', () => {
  it('extracts sections', () => {
    const body = '# Introduction\n\n## Details\n';
    const syms = extractMarkdownSymbols('test.md', body);
    const sections = syms.filter((s) => s.kind === 'section');
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections[0].sectionPath).toContain('Introduction');
  });

  it('extracts bullets with labels', () => {
    const body = '## Config\n\n- **HOST**: the hostname\n';
    const syms = extractMarkdownSymbols('test.md', body);
    const bullets = syms.filter((s) => s.kind === 'bullet');
    expect(bullets.length).toBeGreaterThanOrEqual(1);
    expect(bullets[0].label).toBe('HOST');
  });

  it('produces fingerprintHash for bullets', () => {
    const body = '- Something [link](file.ts)\n';
    const syms = extractMarkdownSymbols('test.md', body);
    expect(syms[0].fingerprintHash).toBeDefined();
  });
});

describe('diffMarkdownFingerprints', () => {
  it('same fingerprint hashes → no changes (paraphrase-only)', () => {
    const body1 = '- **HOST**: the hostname at [foo.ts](foo.ts)\n';
    const body2 = '- **HOST**: the hostname location at [foo.ts](foo.ts)\n'; // rephrased but same link
    const s1 = extractMarkdownSymbols('test.md', body1);
    const s2 = extractMarkdownSymbols('test.md', body2);
    const diff = diffMarkdownFingerprints(s1, s2);
    expect(diff.changed).toHaveLength(0);
  });

  it('new link → changed fingerprint (not filtered)', () => {
    const body1 = '- **HOST**: foo\n';
    const body2 = '- **HOST**: foo [new-link](new.ts)\n'; // new link added
    const s1 = extractMarkdownSymbols('test.md', body1);
    const s2 = extractMarkdownSymbols('test.md', body2);
    const diff = diffMarkdownFingerprints(s1, s2);
    expect(diff.changed).toHaveLength(1);
  });
});
