import { buildSourceMap } from './source-map';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('buildSourceMap', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrick-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeWikiPage(relPath: string, content: string) {
    const fullPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  it('builds inverted source map from page frontmatter', () => {
    writeWikiPage('entities/user.md', `---
slug: entities/user
category: entities
sources:
  - src/models/user.ts
  - src/dto/user.dto.ts
related: []
updated: 2026-05-08
---

# User`);

    writeWikiPage('logic/auth-flow.md', `---
slug: logic/auth-flow
category: logic
sources:
  - src/models/user.ts
  - src/auth/auth.service.ts
related: []
updated: 2026-05-08
---

# Auth Flow`);

    const result = buildSourceMap(tmpDir);

    expect(result['src/models/user.ts']).toEqual(expect.arrayContaining(['entities/user', 'logic/auth-flow']));
    expect(result['src/dto/user.dto.ts']).toEqual(['entities/user']);
    expect(result['src/auth/auth.service.ts']).toEqual(['logic/auth-flow']);
  });

  it('returns empty map for wiki with no pages', () => {
    const result = buildSourceMap(tmpDir);
    expect(result).toEqual({});
  });

  it('skips pages without sources frontmatter', () => {
    writeWikiPage('entities/thing.md', `# Just a heading, no frontmatter`);
    const result = buildSourceMap(tmpDir);
    expect(result).toEqual({});
  });

  it('parses inline sources array', () => {
    writeWikiPage('config/env.md', `---
slug: config/env
category: config
sources: [src/config/config.ts, src/app.module.ts]
related: []
updated: 2026-05-08
---

# Config`);

    const result = buildSourceMap(tmpDir);
    expect(result['src/config/config.ts']).toEqual(['config/env']);
    expect(result['src/app.module.ts']).toEqual(['config/env']);
  });
});
