import { parse as parseYaml } from 'yaml';

/**
 * Parses YAML frontmatter from a markdown string with a leading `---` block.
 * Returns an empty object if no frontmatter is present.
 */
export function parseFrontmatter(content: string): Record<string, unknown> {
  if (!content.startsWith('---')) return {};
  const end = content.indexOf('\n---', 3);
  if (end === -1) return {};
  const yamlStr = content.slice(3, end).trim();
  try {
    const parsed = parseYaml(yamlStr);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
