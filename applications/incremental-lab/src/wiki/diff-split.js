/**
 * Split a unified-diff text blob into per-file blocks. Each block keeps the
 * original git diff header so the downstream LLM sees full context.
 */

export function parseUnifiedDiff(text) {
  if (!text) return [];
  const blocks = [];
  const lines = text.split('\n');
  let current = null;
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (current) blocks.push(current);
      const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const file = m ? m[2] : null;
      current = { file, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks
    .filter((b) => b.file)
    .map((b) => ({ file: b.file, text: b.lines.join('\n') }));
}
