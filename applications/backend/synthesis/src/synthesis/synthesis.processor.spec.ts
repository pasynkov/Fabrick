// Mock @anthropic-ai/sdk before any imports
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

// Mock fs.readFileSync to avoid reading the actual prompt file
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockReturnValue('You are a synthesis assistant.'),
}));

// Mock fetch for callback reporting
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { Test } from '@nestjs/testing';
import { SynthesisProcessor } from './synthesis.processor';
import { QUEUE_SERVICE } from '../queue/queue.module';
import { StorageService } from '../storage/storage.service';

const mockStorage = () => ({
  listObjects: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
});
const mockQueue = () => ({
  publish: jest.fn(),
  subscribe: jest.fn(),
});

function makeAnthropicResponse(text: string, stop_reason = 'end_turn') {
  return {
    content: [{ type: 'text', text }],
    stop_reason,
  };
}

function makeDelimiterResponse(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([name, content]) => `=== FILE: ${name} ===\n${content}`)
    .join('\n\n');
}

describe('SynthesisProcessor', () => {
  let processor: SynthesisProcessor;
  let storageService: ReturnType<typeof mockStorage>;
  let queueService: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SynthesisProcessor,
        { provide: StorageService, useFactory: mockStorage },
        { provide: QUEUE_SERVICE, useFactory: mockQueue },
      ],
    }).compile();

    processor = module.get(SynthesisProcessor);
    storageService = module.get(StorageService);
    queueService = module.get(QUEUE_SERVICE);

    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  const baseJob = {
    projectId: 'proj1',
    orgSlug: 'myorg',
    projectSlug: 'myproject',
    repos: [{ id: 'repo1', slug: 'myrepo' }],
    callbackToken: 'callback-token',
    anthropicApiKey: 'test-api-key',
  };

  describe('processJob — happy path', () => {
    it('loads context files, calls Anthropic, stores synthesis files, reports done', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/context/summary.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('# Summary content'));
      storageService.putObject.mockResolvedValue(undefined);

      const synthesisOutput = makeDelimiterResponse({
        'index.md': '# Project Index',
        'apps/api.md': '## API Details',
      });
      mockMessagesCreate.mockResolvedValue(makeAnthropicResponse(synthesisOutput));

      await (processor as any).processJob(baseJob);

      // Loaded context
      expect(storageService.listObjects).toHaveBeenCalledWith('myorg', 'myproject/myrepo/context/');
      expect(storageService.getObject).toHaveBeenCalledWith('myorg', 'myproject/myrepo/context/summary.md');

      // Called Anthropic with correct model
      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'claude-opus-4-6',
        messages: [{ role: 'user', content: expect.stringContaining('# Summary content') }],
      }));

      // Stored synthesis files
      expect(storageService.putObject).toHaveBeenCalledWith(
        'myorg',
        'myproject/synthesis/index.md',
        expect.any(Buffer),
      );
      expect(storageService.putObject).toHaveBeenCalledWith(
        'myorg',
        'myproject/synthesis/apps/api.md',
        expect.any(Buffer),
      );

      // Reported done via callback
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/synthesis/status'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer callback-token' }),
          body: expect.stringContaining('"status":"done"'),
        }),
      );
    });

    it('processes multiple repos, concatenates context blocks', async () => {
      const job = {
        ...baseJob,
        repos: [
          { id: 'repo1', slug: 'repo-a' },
          { id: 'repo2', slug: 'repo-b' },
        ],
      };

      storageService.listObjects
        .mockResolvedValueOnce(['myproject/repo-a/context/a.md'])
        .mockResolvedValueOnce(['myproject/repo-b/context/b.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('file content'));
      storageService.putObject.mockResolvedValue(undefined);

      mockMessagesCreate.mockResolvedValue(makeAnthropicResponse(makeDelimiterResponse({ 'index.md': 'ok' })));

      await (processor as any).processJob(job);

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      const userContent = callArgs.messages[0].content as string;
      expect(userContent).toContain('=== REPO: repo-a ===');
      expect(userContent).toContain('=== REPO: repo-b ===');
    });
  });

  describe('processJob — error handling', () => {
    it('reports error when no context files found', async () => {
      storageService.listObjects.mockResolvedValue([]);

      await (processor as any).processJob(baseJob);

      expect(mockMessagesCreate).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"status":"error"'),
        }),
      );
    });

    it('reports error when response has no === FILE: markers', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/context/a.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      mockMessagesCreate.mockResolvedValue(makeAnthropicResponse('This is not delimiter format at all.'));

      await (processor as any).processJob(baseJob);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"status":"error"'),
        }),
      );
      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.error).toBe('No files found in Claude response');
    });

    it('reports error when stop_reason is max_tokens', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/context/a.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      mockMessagesCreate.mockResolvedValue(makeAnthropicResponse('partial...', 'max_tokens'));

      await (processor as any).processJob(baseJob);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"status":"error"'),
        }),
      );
    });

    it('reports error when Anthropic throws', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/context/a.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      mockMessagesCreate.mockRejectedValue(new Error('API overloaded'));

      await (processor as any).processJob(baseJob);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('API overloaded'),
        }),
      );
    });

    it('sends system prompt to Anthropic', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/context/a.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('ctx'));
      storageService.putObject.mockResolvedValue(undefined);
      mockMessagesCreate.mockResolvedValue(makeAnthropicResponse(makeDelimiterResponse({ 'index.md': 'x' })));

      await (processor as any).processJob(baseJob);

      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        system: 'You are a synthesis assistant.',
      }));
    });

    it('parses file content containing quotes and newlines correctly', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/context/a.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      storageService.putObject.mockResolvedValue(undefined);

      const complexContent = `# Title\n\nSome "quoted" text\nand a backslash: \\\nand another line.`;
      const response = `=== FILE: index.md ===\n${complexContent}`;
      mockMessagesCreate.mockResolvedValue(makeAnthropicResponse(response));

      await (processor as any).processJob(baseJob);

      const [, , storedBuffer] = storageService.putObject.mock.calls[0];
      expect(storedBuffer.toString('utf-8')).toBe(complexContent);
    });
  });

  describe('reportStatus', () => {
    it('sends Authorization header with callbackToken', async () => {
      await (processor as any).reportStatus('proj1', 'my-token', 'done');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
        }),
      );
    });

    it('includes error field when error provided', async () => {
      await (processor as any).reportStatus('proj1', 'tok', 'error', 'Something went wrong');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.error).toBe('Something went wrong');
      expect(body.status).toBe('error');
    });

    it('does not throw when callback fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));
      await expect((processor as any).reportStatus('proj1', 'tok', 'done')).resolves.not.toThrow();
    });
  });
});
