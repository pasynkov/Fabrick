import { HashScanResult } from './hash-scanner';

export function getAffectedPages(
  scanResult: HashScanResult,
  sourceMap: Record<string, string[]>,
): string[] {
  const affected = new Set<string>();
  const changedFiles = [...scanResult.changed, ...scanResult.added];

  for (const file of changedFiles) {
    const pages = sourceMap[file] ?? [];
    for (const page of pages) affected.add(page);
  }

  return Array.from(affected);
}
