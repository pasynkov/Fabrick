import { Injectable } from '@nestjs/common';
import * as unzipper from 'unzipper';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ContextService {
  private readonly bucket = 'fabrick';

  constructor(private readonly storageService: StorageService) {}

  async uploadZip(repo: string, buffer: Buffer): Promise<void> {
    const directory = await unzipper.Open.buffer(buffer);
    for (const entry of directory.files) {
      if (entry.type === 'File') {
        const content = await entry.buffer();
        await this.storageService.putObject(
          this.bucket,
          `${repo}/context/${entry.path}`,
          content,
        );
      }
    }
  }

  async listFiles(repo: string): Promise<string[]> {
    return this.storageService.listObjects(this.bucket, `${repo}/context/`);
  }
}
