import { Injectable } from '@nestjs/common';
import * as unzipper from 'unzipper';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class ContextService {
  private readonly bucket = 'fabrick';

  constructor(private readonly minioService: MinioService) {}

  async uploadZip(repo: string, buffer: Buffer): Promise<void> {
    const directory = await unzipper.Open.buffer(buffer);
    for (const entry of directory.files) {
      if (entry.type === 'File') {
        const content = await entry.buffer();
        await this.minioService.putObject(
          this.bucket,
          `${repo}/context/${entry.path}`,
          content,
        );
      }
    }
  }

  async listFiles(repo: string): Promise<string[]> {
    return this.minioService.listObjects(this.bucket, `${repo}/context/`);
  }
}
