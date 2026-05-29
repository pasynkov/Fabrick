// Mock fetch for HTTP callbacks
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { Test } from '@nestjs/testing';
import { SynthesisProcessor } from './synthesis.processor';
import { QUEUE_SERVICE } from '../queue/queue.module';
import { StorageService } from '../storage/storage.service';
import { SynthesisImpl } from '@app/shared';

const mockStorage = () => ({
  listObjects: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
});

const mockQueue = () => ({
  publish: jest.fn(),
  subscribe: jest.fn(),
});

const mockSynthesisImpl = () => ({
  buildContext: jest.fn().mockReturnValue('context string'),
  synthesize: jest.fn().mockResolvedValue({ rawText: 'raw claude response', usage: { inputTokens: 100, outputTokens: 200 } }),
  parseResponse: jest.fn().mockReturnValue({
    pages: [{ slug: 'index', category: 'overview', title: 'Index', content: '# Index', sources: [], related: [] }],
    deleteSlugs: [],
  }),
});

describe('SynthesisProcessor', () => {
  let processor: SynthesisProcessor;
  let storageService: ReturnType<typeof mockStorage>;
  let synthesisImpl: ReturnType<typeof mockSynthesisImpl>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SynthesisProcessor,
        { provide: StorageService, useFactory: mockStorage },
        { provide: QUEUE_SERVICE, useFactory: mockQueue },
        { provide: SynthesisImpl, useFactory: mockSynthesisImpl },
      ],
    }).compile();

    processor = module.get(SynthesisProcessor);
    storageService = module.get(StorageService);
    synthesisImpl = module.get(SynthesisImpl);

    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ pages: [] }), text: jest.fn().mockResolvedValue('') });
  });

  const baseJob = {
    projectId: 'proj1',
    orgSlug: 'myorg',
    projectSlug: 'myproject',
    repos: [{ id: 'repo1', slug: 'myrepo' }],
    changedRepos: ['myrepo'],
    callbackToken: 'callback-token',
    anthropicApiKey: 'test-api-key',
  };

  describe('processJob — happy path', () => {
    it('loads wiki files, calls SynthesisImpl, upserts pages, reports done', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/wiki/index.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('# Wiki content'));

      await (processor as any).processJob(baseJob);

      expect(storageService.listObjects).toHaveBeenCalledWith('myorg', 'myproject/myrepo/wiki/');
      expect(storageService.getObject).toHaveBeenCalledWith('myorg', 'myproject/myrepo/wiki/index.md');

      expect(synthesisImpl.buildContext).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ slug: 'myrepo' }),
        ]),
        expect.any(Array),
        ['myrepo'],
      );

      expect(synthesisImpl.synthesize).toHaveBeenCalledWith('context string', 'test-api-key');
      expect(synthesisImpl.parseResponse).toHaveBeenCalledWith('raw claude response');

      // Records token usage for the synthesis call
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/internal/synthesis/token-usage'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"inputTokens":100'),
        }),
      );

      // Upserted pages
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/internal/synthesis/pages'),
        expect.objectContaining({ method: 'PUT' }),
      );

      // Reported done
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/internal/synthesis/status'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"status":"done"'),
        }),
      );
    });

    it('processes multiple repos, passes all to buildContext', async () => {
      const job = {
        ...baseJob,
        repos: [
          { id: 'repo1', slug: 'repo-a' },
          { id: 'repo2', slug: 'repo-b' },
        ],
        changedRepos: ['repo-a', 'repo-b'],
      };

      storageService.listObjects
        .mockResolvedValueOnce(['myproject/repo-a/wiki/a.md'])
        .mockResolvedValueOnce(['myproject/repo-b/wiki/b.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('file content'));

      await (processor as any).processJob(job);

      const [repoWikis] = (synthesisImpl.buildContext as jest.Mock).mock.calls[0];
      expect(repoWikis).toHaveLength(2);
      expect(repoWikis[0].slug).toBe('repo-a');
      expect(repoWikis[1].slug).toBe('repo-b');
    });

    it('skips token-usage call when usage payload is missing', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/wiki/index.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      (synthesisImpl.synthesize as jest.Mock).mockResolvedValue({ rawText: 'raw claude response', usage: null });

      await (processor as any).processJob(baseJob);

      const tokenUsageCalls = mockFetch.mock.calls.filter(
        (c: any) => typeof c[0] === 'string' && c[0].includes('/v1/internal/synthesis/token-usage'),
      );
      expect(tokenUsageCalls.length).toBe(0);
    });

    it('calls deletePages when parsedResponse has deleteSlugs', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/wiki/index.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      (synthesisImpl.parseResponse as jest.Mock).mockReturnValue({
        pages: [{ slug: 'index', category: 'overview', title: 'Index', content: '', sources: [], related: [] }],
        deleteSlugs: ['old-page'],
      });

      await (processor as any).processJob(baseJob);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/internal/synthesis/pages'),
        expect.objectContaining({
          method: 'DELETE',
          body: expect.stringContaining('old-page'),
        }),
      );
    });
  });

  describe('processJob — error handling', () => {
    it('reports error when no wiki files found', async () => {
      storageService.listObjects.mockResolvedValue([]);

      await (processor as any).processJob(baseJob);

      expect(synthesisImpl.synthesize).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"status":"error"'),
        }),
      );
    });

    it('reports error when parseResponse returns no pages', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/wiki/index.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      (synthesisImpl.parseResponse as jest.Mock).mockReturnValue({ pages: [], deleteSlugs: [] });

      await (processor as any).processJob(baseJob);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"status":"error"'),
        }),
      );
    });

    it('reports error when SynthesisImpl.synthesize throws', async () => {
      storageService.listObjects.mockResolvedValue(['myproject/myrepo/wiki/index.md']);
      storageService.getObject.mockResolvedValue(Buffer.from('content'));
      (synthesisImpl.synthesize as jest.Mock).mockRejectedValue(new Error('API overloaded'));

      await (processor as any).processJob(baseJob);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('API overloaded'),
        }),
      );
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
