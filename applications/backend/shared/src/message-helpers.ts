import type {
  ContentBlock,
  ContentBlockParam,
} from '@anthropic-ai/sdk/resources/messages/messages';

export function extractText(content: ContentBlock[] | undefined): string | null {
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.length ? parts.join('\n').trim() : null;
}

export function toContentBlockParams(content: ContentBlock[]): ContentBlockParam[] {
  return content.map((b) => {
    if (b.type === 'text') return { type: 'text', text: b.text };
    if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
    if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking, signature: b.signature };
    if (b.type === 'redacted_thinking') return { type: 'redacted_thinking', data: b.data };
    return { type: 'text', text: '' };
  });
}

export function truncate(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
