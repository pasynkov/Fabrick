/**
 * Synthesis pages must cite WIKI pages, not source files. The skill instructs
 * the model to do so, but it occasionally leaks src-paths inherited from the
 * wiki bodies it bundled. This deterministic post-processor rewrites any
 * link whose path resolves to a source file in one of the input repos into
 * the corresponding wiki-page link.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileSlugMapPath } from '../cli/state.js';

function loadFileSlugMap(repoPath) {
  const p = fileSlugMapPath(repoPath);
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')).files ?? {}; }
  catch { return {}; }
}

const VALID_SYNTH_LINK = /^repos\/[^/]+\/scopes\/[^/]+\/[^/]+$/;
const EXTERNAL_LINK = /^(https?:|mailto:|#)/i;

export function buildSynthLinkRewriter(repos) {
  // repos: [{ repoName, repoPath, scopes: [{ root, dirName }, ...] }]
  const indexed = repos.map((r) => ({
    repoName: r.repoName,
    map: loadFileSlugMap(r.repoPath),
    scopes: r.scopes,
  }));

  return (body) => {
    if (!body) return { body, rewrites: 0, unresolved: 0 };
    let rewrites = 0;
    let unresolved = 0;
    const out = body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, rawPath) => {
      const path = rawPath.split('#')[0].trim();
      if (!path) return match;
      if (VALID_SYNTH_LINK.test(path)) return match;
      if (EXTERNAL_LINK.test(rawPath)) return match;
      // Try to resolve as a source-file path against each repo + scope.
      for (const { repoName, scopes, map } of indexed) {
        for (const scope of scopes) {
          const full = `${scope.root}/${path}`;
          const entry = map[full];
          if (entry && entry.slugs?.length) {
            const slug = entry.slugs[0];
            rewrites += 1;
            return `[${text}](repos/${repoName}/scopes/${scope.dirName}/${slug})`;
          }
        }
      }
      unresolved += 1;
      return match;
    });
    return { body: out, rewrites, unresolved };
  };
}
