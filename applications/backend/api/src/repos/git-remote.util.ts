export function normalizeGitRemote(remote: string): string {
  // ssh: git@github.com:org/repo.git → github.com/org/repo
  // https: https://github.com/org/repo.git → github.com/org/repo
  let normalized = remote.trim();
  normalized = normalized.replace(/\.git$/, '');
  if (normalized.startsWith('git@')) {
    normalized = normalized.replace('git@', '').replace(':', '/');
  } else {
    normalized = normalized.replace(/^https?:\/\//, '');
  }
  return normalized;
}

export function slugFromRemote(normalized: string): string {
  const parts = normalized.split('/');
  return parts[parts.length - 1];
}
