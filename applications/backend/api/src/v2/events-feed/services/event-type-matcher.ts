/**
 * Translates one or more `*`-wildcard glob patterns into SQL LIKE clauses.
 * Multiple comma-separated patterns are treated as a disjunction (OR).
 */
export function buildTypeFilter(patterns: string): { sql: string; params: string[] } {
  const parts = patterns.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { sql: '', params: [] };

  const conditions: string[] = [];
  const params: string[] = [];

  for (const pattern of parts) {
    const likePat = pattern.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/\*/g, '%');
    conditions.push(`pe.type LIKE $${params.length + 1}`);
    params.push(likePat);
  }

  return { sql: `(${conditions.join(' OR ')})`, params };
}
