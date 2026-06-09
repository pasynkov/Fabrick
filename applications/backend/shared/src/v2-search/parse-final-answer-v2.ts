export interface ParsedFinalAnswerV2 {
  answer: string;
  reasoning?: string;
  sources: string[];
  hadBriefMarker: boolean;
  hadSourcesLine: boolean;
}

export function parseFinalAnswerV2(text: string): ParsedFinalAnswerV2 {
  const lines = text.split(/\r?\n/);

  // Find SOURCES: line scanning from the end for trailing whitespace tolerance.
  let sourcesIdx = -1;
  let rawSources: string[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(/^\s*SOURCES:\s*(.*)$/i);
    if (m) {
      sourcesIdx = i;
      rawSources = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      break;
    }
    if (lines[i].trim()) break;
  }

  // Strip compendium/index from sources
  const sources = rawSources.filter((s) => s !== 'compendium/index');

  const bodyEnd = sourcesIdx >= 0 ? sourcesIdx : lines.length;
  const bodyLines = lines.slice(0, bodyEnd);

  // Look for BRIEF: / REASONING: markers
  let briefIdx = -1;
  let reasoningIdx = -1;
  for (let i = 0; i < bodyLines.length; i += 1) {
    const stripped = bodyLines[i].trim();
    if (briefIdx === -1 && /^BRIEF:\s*$/.test(stripped)) {
      briefIdx = i;
      continue;
    }
    if (briefIdx !== -1 && reasoningIdx === -1 && /^REASONING:\s*$/.test(stripped)) {
      reasoningIdx = i;
    }
  }

  const hadSourcesLine = sourcesIdx >= 0;
  const hadBriefMarker = briefIdx >= 0;

  if (!hadBriefMarker) {
    const answer = bodyLines.join('\n').trim();
    return { answer, sources, hadBriefMarker, hadSourcesLine };
  }

  const briefStart = briefIdx + 1;
  const briefEnd = reasoningIdx === -1 ? bodyLines.length : reasoningIdx;
  const answer = bodyLines.slice(briefStart, briefEnd).join('\n').trim();

  let reasoning: string | undefined;
  if (reasoningIdx >= 0) {
    reasoning = bodyLines.slice(reasoningIdx + 1).join('\n').trim();
    if (reasoning.length === 0) reasoning = undefined;
  }

  const result: ParsedFinalAnswerV2 = { answer, sources, hadBriefMarker, hadSourcesLine };
  if (reasoning !== undefined) result.reasoning = reasoning;
  return result;
}
