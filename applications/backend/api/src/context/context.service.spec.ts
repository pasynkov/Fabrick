import { Test } from '@nestjs/testing';
import { ContextService } from './context.service';
import { StorageService } from '../storage/storage.service';

jest.mock('unzipper', () => ({
  Open: {
    buffer: jest.fn(),
  },
}));

import * as unzipper from 'unzipper';

const mockStorage = () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  listObjects: jest.fn(),
});

describe('ContextService', () => {
  let service: ContextService;
  let storageService: ReturnType<typeof mockStorage>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContextService,
        { provide: StorageService, useFactory: mockStorage },
      ],
    }).compile();

    service = module.get(ContextService);
    storageService = module.get(StorageService);
    jest.clearAllMocks();
  });

  describe('uploadZip', () => {
    it('calls putObject with correct key for each file', async () => {
      const fileContent = Buffer.from('hello world');
      (unzipper.Open.buffer as jest.Mock).mockResolvedValue({
        files: [
          { type: 'File', path: 'summary.md', buffer: jest.fn().mockResolvedValue(fileContent) },
        ],
      });

      await service.uploadZip('myorg/myproject/myrepo', Buffer.alloc(10));

      expect(storageService.putObject).toHaveBeenCalledWith(
        'fabrick',
        'myorg/myproject/myrepo/context/summary.md',
        fileContent,
      );
    });

    it('skips directory entries', async () => {
      (unzipper.Open.buffer as jest.Mock).mockResolvedValue({
        files: [
          { type: 'Directory', path: 'dir/' },
          { type: 'File', path: 'dir/file.md', buffer: jest.fn().mockResolvedValue(Buffer.from('content')) },
        ],
      });

      await service.uploadZip('repo', Buffer.alloc(10));

      expect(storageService.putObject).toHaveBeenCalledTimes(1);
      expect(storageService.putObject).toHaveBeenCalledWith(
        'fabrick',
        'repo/context/dir/file.md',
        expect.any(Buffer),
      );
    });
  });

  describe('listFiles', () => {
    it('delegates to storageService.listObjects', async () => {
      storageService.listObjects.mockResolvedValue(['repo/context/index.md']);

      const result = await service.listFiles('repo');

      expect(storageService.listObjects).toHaveBeenCalledWith('fabrick', 'repo/context/');
      expect(result).toEqual(['repo/context/index.md']);
    });
  });
});
