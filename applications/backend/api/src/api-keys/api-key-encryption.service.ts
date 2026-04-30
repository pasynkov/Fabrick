import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

@Injectable()
export class ApiKeyEncryptionService {
  private readonly logger = new Logger(ApiKeyEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';

  encrypt(plaintext: string): string {
    try {
      const key = this.deriveKey();
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from('anthropic-api-key'));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error: any) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Failed to encrypt API key');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const key = this.deriveKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAAD(Buffer.from('anthropic-api-key'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Failed to decrypt API key');
    }
  }

  generateKeyHash(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  }

  private deriveKey(): Buffer {
    const globalKey = process.env.ANTHROPIC_API_KEY || 'default-encryption-key-for-testing';
    return Buffer.from(globalKey.padEnd(32, '0').slice(0, 32));
  }
}
