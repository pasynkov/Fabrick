import { parseFinalAnswer } from '../search/search.impl';

export interface ParsedFinalAnswerV2 {
  answer: string;
  reasoning?: string;
  sources: string[];
  hadBriefMarker: boolean;
  hadSourcesLine: boolean;
}

export function parseFinalAnswerV2(text: string): ParsedFinalAnswerV2 {
  const parsed = parseFinalAnswer(text);
  return {
    ...parsed,
    sources: parsed.sources.filter((s) => s !== 'compendium/index'),
  };
}
