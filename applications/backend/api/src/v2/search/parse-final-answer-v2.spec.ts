import { parseFinalAnswerV2 } from '@app/shared';

describe('parseFinalAnswerV2', () => {
  describe('BRIEF/REASONING split', () => {
    it('parses BRIEF only', () => {
      const text = 'BRIEF:\nShort answer.\nSOURCES: compendium/system';
      const result = parseFinalAnswerV2(text);
      expect(result.answer).toBe('Short answer.');
      expect(result.reasoning).toBeUndefined();
      expect(result.hadBriefMarker).toBe(true);
      expect(result.hadSourcesLine).toBe(true);
    });

    it('parses BRIEF and REASONING', () => {
      const text = 'BRIEF:\nShort answer.\nREASONING:\nLong rationale.\nSOURCES: compendium/system';
      const result = parseFinalAnswerV2(text);
      expect(result.answer).toBe('Short answer.');
      expect(result.reasoning).toBe('Long rationale.');
      expect(result.sources).toEqual(['compendium/system']);
    });

    it('returns full text when no BRIEF marker', () => {
      const text = 'Just an answer without markers.\nSOURCES: dossier/cli/cmd/service';
      const result = parseFinalAnswerV2(text);
      expect(result.answer).toBe('Just an answer without markers.');
      expect(result.hadBriefMarker).toBe(false);
      expect(result.hadSourcesLine).toBe(true);
    });
  });

  describe('qualified-source parsing', () => {
    it('parses compendium/<slug> sources', () => {
      const text = 'BRIEF:\nAnswer.\nSOURCES: compendium/system, compendium/data-flows';
      const result = parseFinalAnswerV2(text);
      expect(result.sources).toEqual(['compendium/system', 'compendium/data-flows']);
    });

    it('parses dossier/<repo>/<scope>/<slug> sources', () => {
      const text = 'BRIEF:\nAnswer.\nSOURCES: dossier/backend-api/web/service';
      const result = parseFinalAnswerV2(text);
      expect(result.sources).toEqual(['dossier/backend-api/web/service']);
    });

    it('parses mixed compendium and dossier sources', () => {
      const text = 'BRIEF:\nAnswer.\nSOURCES: compendium/system, dossier/backend-api/web/service';
      const result = parseFinalAnswerV2(text);
      expect(result.sources).toEqual(['compendium/system', 'dossier/backend-api/web/service']);
    });

    it('strips compendium/index from sources', () => {
      const text = 'BRIEF:\nAnswer.\nSOURCES: compendium/index, dossier/cli/cmd/service';
      const result = parseFinalAnswerV2(text);
      expect(result.sources).toEqual(['dossier/cli/cmd/service']);
    });

    it('strips compendium/index when it is the only source', () => {
      const text = 'BRIEF:\nAnswer.\nSOURCES: compendium/index';
      const result = parseFinalAnswerV2(text);
      expect(result.sources).toEqual([]);
    });
  });

  describe('no-SOURCES fallback', () => {
    it('returns empty sources and hadSourcesLine=false when no SOURCES line', () => {
      const text = 'BRIEF:\nSome answer with no sources.';
      const result = parseFinalAnswerV2(text);
      expect(result.hadSourcesLine).toBe(false);
      expect(result.sources).toEqual([]);
      expect(result.answer).toBe('Some answer with no sources.');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = parseFinalAnswerV2('');
      expect(result.answer).toBe('');
      expect(result.sources).toEqual([]);
      expect(result.hadBriefMarker).toBe(false);
      expect(result.hadSourcesLine).toBe(false);
    });

    it('handles trailing whitespace after SOURCES line', () => {
      const text = 'BRIEF:\nAnswer.\nSOURCES: compendium/system   ';
      const result = parseFinalAnswerV2(text);
      expect(result.sources).toEqual(['compendium/system']);
    });
  });
});
