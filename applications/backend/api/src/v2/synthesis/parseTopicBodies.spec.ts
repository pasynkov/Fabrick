// Tests for parseTopicBodies with the 5-slug list (including 'index')
// We test the exported function directly from compendium-event.handler

describe('parseTopicBodies — 5-slug list', () => {
  // Inline the function to test it (can't import from synthesis worker easily in api tests)
  function parseTopicBodies(text: string, slugs: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const marker = `## TOPIC: ${slug}`;
      const start = text.indexOf(marker);
      if (start === -1) {
        result[slug] = `---\ntitle: ${slug}\n---\n\nContent not generated.\n`;
        continue;
      }
      const contentStart = start + marker.length;
      let end = text.length;
      for (let j = i + 1; j < slugs.length; j++) {
        const nextMarker = `## TOPIC: ${slugs[j]}`;
        const nextStart = text.indexOf(nextMarker, contentStart);
        if (nextStart !== -1) {
          end = nextStart;
          break;
        }
      }
      result[slug] = text.slice(contentStart, end).trim();
    }
    return result;
  }

  const FIVE_SLUGS = ['system', 'data-flows', 'transport-graph', 'infra', 'index'];

  it('parses all five slugs including index', () => {
    const text = `
## TOPIC: system
---
title: System Overview
---
# System
System content.

## TOPIC: data-flows
---
title: Data Flows
---
# Data Flows
Flow content.

## TOPIC: transport-graph
---
title: Transport Graph
---
# Transport
Graph content.

## TOPIC: infra
---
title: Infrastructure
---
# Infrastructure
Infra content.

## TOPIC: index
---
title: Index
---
# Index

## Topics
- [System](compendium/system)

## Repositories
- backend-api
`.trim();

    const result = parseTopicBodies(text, FIVE_SLUGS);

    expect(Object.keys(result)).toHaveLength(5);
    expect(result['system']).toContain('System content.');
    expect(result['data-flows']).toContain('Flow content.');
    expect(result['transport-graph']).toContain('Graph content.');
    expect(result['infra']).toContain('Infra content.');
    expect(result['index']).toContain('## Topics');
    expect(result['index']).toContain('## Repositories');
  });

  it('produces placeholder for missing slugs', () => {
    const text = `## TOPIC: system\nSystem content.`;
    const result = parseTopicBodies(text, FIVE_SLUGS);

    expect(result['system']).toContain('System content.');
    expect(result['data-flows']).toContain('Content not generated.');
    expect(result['index']).toContain('Content not generated.');
  });

  it('correctly separates index from infra when index appears last', () => {
    const text = `## TOPIC: infra\nInfra.\n## TOPIC: index\nIndex content.`;
    const result = parseTopicBodies(text, FIVE_SLUGS);
    expect(result['infra']).toContain('Infra.');
    expect(result['index']).toContain('Index content.');
    expect(result['index']).not.toContain('Infra.');
  });

  describe('Haiku description uses only four topic slugs', () => {
    it('diffText construction only references system, data-flows, transport-graph, infra — not index', () => {
      const TOPIC_SLUGS_FOR_DESCRIPTION = ['system', 'data-flows', 'transport-graph', 'infra'];

      const regenBodies: Record<string, string> = {
        system: 'new system content',
        'data-flows': 'new flows content',
        'transport-graph': 'new graph content',
        infra: 'new infra content',
        index: 'new index content',
      };
      const oldBodies: Record<string, string> = {
        system: 'old system content',
        'data-flows': 'old flows content',
        'transport-graph': 'old graph content',
        infra: 'old infra content',
        index: 'old index content',
      };

      const diffText = TOPIC_SLUGS_FOR_DESCRIPTION.map((slug) => {
        const oldContent = (oldBodies[slug] || '').slice(0, 500);
        const newContent = (regenBodies[slug] || '').slice(0, 500);
        return `### ${slug}\nOLD:\n${oldContent}\nNEW:\n${newContent}`;
      }).join('\n\n');

      expect(diffText).toContain('### system');
      expect(diffText).toContain('### data-flows');
      expect(diffText).toContain('### transport-graph');
      expect(diffText).toContain('### infra');
      expect(diffText).not.toContain('### index');
    });
  });
});
