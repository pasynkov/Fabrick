import { callClaude } from './cli.js';

export async function generateCommitNarrative({ diff, claudeOpts = {} }) {
  const prompt = buildNarrativePrompt({ diff });
  const res = await callClaude(prompt, claudeOpts);
  return { narrative: res.content.trim(), prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export function buildNarrativePrompt({ diff }) {
  const lines = ['You are a code-change narrator. Read the symbol-level diff and write a short prose summary that downstream wiki updaters will use as ground truth.', ''];

  lines.push('WHAT CHANGED (symbol-level):');
  let lineCount = 0;
  const MAX = 60;
  for (const s of diff.symbols.added) {
    if (lineCount++ >= MAX) break;
    lines.push(`  added ${s.kind}: ${s.name}  ${s.signature}`);
  }
  for (const { before, after } of diff.symbols.sigChanged) {
    if (lineCount++ >= MAX) break;
    lines.push(`  sig changed: ${after.name}`);
    lines.push(`    before: ${before.signature}`);
    lines.push(`    after:  ${after.signature}`);
  }
  for (const { after } of diff.symbols.bodyChanged) {
    if (lineCount++ >= MAX) break;
    lines.push(`  body changed: ${after.name} (${after.kind})`);
  }
  for (const s of diff.symbols.deleted) {
    if (lineCount++ >= MAX) break;
    lines.push(`  removed ${s.kind}: ${s.name}`);
  }

  if (diff.importsChanged?.length) {
    lines.push('', 'IMPORTS:');
    for (const ic of diff.importsChanged.slice(0, 10)) {
      if (ic.addedImports?.length) lines.push(`  ${ic.file}: +${ic.addedImports.join(', ')}`);
      if (ic.removedImports?.length) lines.push(`  ${ic.file}: -${ic.removedImports.join(', ')}`);
    }
  }

  if (diff.files?.added?.length || diff.files?.deleted?.length) {
    lines.push('', 'FILES:');
    for (const f of diff.files.added) lines.push(`  +${f}`);
    for (const f of diff.files.deleted) lines.push(`  -${f}`);
  }

  lines.push('', 'INSTRUCTIONS:');
  lines.push('- Write 2–5 sentences in plain prose.');
  lines.push('- Focus on user-visible behavior and architectural shifts (new endpoints, swapped algorithms, new dependencies, scale tuning).');
  lines.push('- Small mechanical-looking diffs CAN be architecturally important — call them out explicitly (e.g. "concurrency doubled from 4 to 8 workers").');
  lines.push('- Skip pure renames and formatting.');
  lines.push('- No marketing language, no bullet points, no markdown fences.');
  lines.push('- Return ONLY the summary text. Do not use any tools.');

  return lines.join('\n');
}
