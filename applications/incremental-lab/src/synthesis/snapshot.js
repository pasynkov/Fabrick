import { createHash } from 'node:crypto';

/**
 * Synthesis-level snapshot: collection of (repo, slug, hash, body) for every
 * wiki page across all participating repos. This is the input to synthesis diff.
 */

export const SYNTHESIS_SNAPSHOT_VERSION = 1;

export function buildSynthesisSnapshot(perRepoWikis) {
  // perRepoWikis: { [repoName]: { slug: body } }
  const repos = {};
  for (const [repoName, pages] of Object.entries(perRepoWikis)) {
    repos[repoName] = { pages: {} };
    for (const [slug, body] of Object.entries(pages)) {
      repos[repoName].pages[slug] = { hash: hashContent(body), bytes: body.length };
    }
  }
  return { version: SYNTHESIS_SNAPSHOT_VERSION, repos };
}

function hashContent(s) { return createHash('sha256').update(s ?? '').digest('hex').slice(0, 16); }
