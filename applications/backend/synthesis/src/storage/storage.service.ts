import { Injectable, Logger } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: BlobServiceClient;

  constructor() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    }
    this.client = BlobServiceClient.fromConnectionString(connStr);
  }

  async putObject(container: string, key: string, buffer: Buffer): Promise<void> {
    try {
      const containerClient = this.client.getContainerClient(container);
      await containerClient.createIfNotExists();
      await containerClient.getBlockBlobClient(key).uploadData(buffer);
    } catch (err: any) {
      this.logger.error(`putObject failed: ${err?.message}`);
      throw err;
    }
  }

  async getObject(container: string, key: string): Promise<Buffer> {
    try {
      const blobClient = this.client.getContainerClient(container).getBlobClient(key);
      return await blobClient.downloadToBuffer();
    } catch (err: any) {
      this.logger.error(`getObject failed: ${err?.message}`);
      throw err;
    }
  }

  async listObjects(container: string, prefix: string): Promise<string[]> {
    try {
      const containerClient = this.client.getContainerClient(container);
      await containerClient.createIfNotExists();
      const names: string[] = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        names.push(blob.name);
      }
      return names;
    } catch (err: any) {
      this.logger.error(`listObjects failed: ${err?.message}`);
      throw err;
    }
  }
}
