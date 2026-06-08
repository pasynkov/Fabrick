/**
 * Translates one or more `*`-wildcard glob patterns into a TypeORM-compatible
 * LIKE filter. Multiple comma-separated patterns are treated as OR.
 */
export function buildTypeFilter(patterns: string): { sql: string; params: Record<string, string> } {
  const parts = patterns.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { sql: '', params: {} };

  const conditions: string[] = [];
  const params: Record<string, string> = {};

  parts.forEach((pattern, i) => {
    const key = `typeParam${i}`;
    const likePat = pattern.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/\*/g, '%');
    conditions.push(`pe.type LIKE :${key}`);
    params[key] = likePat;
  });

  return { sql: `(${conditions.join(' OR ')})`, params };
}
