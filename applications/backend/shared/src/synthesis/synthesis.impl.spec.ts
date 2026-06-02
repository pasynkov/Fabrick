import { PromptRecord, PromptRepository } from '../prompt-repository.interface';

const MOCK_PROMPT_RECORD: PromptRecord = {
  id: 'synthesis-prompt-rev-1',
  name: 'synthesis',
  agent: 'claude',
  revision: 1,
  content: {
    files: {
      'prompt.md': 'You are a software architect synthesizing a project-level wiki.',
    },
  },
};

class MockPromptRepo implements PromptRepository {
  readonly calls: Array<{ name: string; agent: string }> = [];
  private readonly record: PromptRecord;
  constructor(record: PromptRecord = MOCK_PROMPT_RECORD) {
    this.record = record;
  }
  async getLatest(name: string, agent: string): Promise<PromptRecord> {
    this.calls.push({ name, agent });
    return this.record;
  }
}

// Mock the Anthropic SDK streaming
let mockStreamEvents: any[] = [];
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        stream: jest.fn().mockImplementation(() => {
          return {
            [Symbol.asyncIterator]: async function* () {
              for (const event of mockStreamEvents) {
                yield event;
              }
            },
          };
        }),
      },
    })),
  };
});

function makeStream(events: any[]): void {
  mockStreamEvents = events;
}

// Import after mock setup
import { SynthesisImpl } from './synthesis.impl';

beforeEach(() => {
  mockStreamEvents = [];
});

describe('SynthesisImpl.synthesize', () => {
  it('calls getLatest once with synthesis/claude and returns promptRevisionId', async () => {
    const promptRepo = new MockPromptRepo();
    makeStream([
      { type: 'message_start', message: { usage: { input_tokens: 100, output_tokens: 0 } } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'raw response' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 200 } },
    ]);

    const impl = new SynthesisImpl(promptRepo);
    const result = await impl.synthesize('context', 'api-key');

    expect(promptRepo.calls).toHaveLength(1);
    expect(promptRepo.calls[0]).toEqual({ name: 'synthesis', agent: 'claude' });
    expect(result.promptRevisionId).toBe(MOCK_PROMPT_RECORD.id);
    expect(result.rawText).toBe('raw response');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 200 });
  });

  it('bubbles up getLatest rejection unchanged', async () => {
    const failingRepo: PromptRepository = {
      async getLatest(name: string, agent: string): Promise<PromptRecord> {
        throw new Error(`Prompt not found: (${name}, ${agent})`);
      },
    };

    const impl = new SynthesisImpl(failingRepo);
    await expect(impl.synthesize('context', 'api-key')).rejects.toThrow(/Prompt not found: \(synthesis, claude\)/);
  });
});
