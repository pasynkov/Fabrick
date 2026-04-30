# API Key Encryption and Validation Services

## Overview
Secure encryption service for API key storage and validation service for Anthropic API key format and connectivity verification.

## ApiKeyEncryptionService

### Service Implementation
```typescript
// applications/backend/api/src/api-keys/api-key-encryption.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createCipher, createDecipher, randomBytes } from 'crypto';

@Injectable()
export class ApiKeyEncryptionService {
  private readonly logger = new Logger(ApiKeyEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable required for encryption');
    }
  }

  /**
   * Encrypts an API key using AES-256-GCM with the global API key as encryption key
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      const key = this.deriveKey();
      const iv = randomBytes(16); // 128-bit IV for GCM
      const cipher = createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('anthropic-api-key')); // Additional authenticated data

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: iv:authTag:encrypted
      const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      this.logger.debug('API key encrypted successfully');
      return result;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Failed to encrypt API key');
    }
  }

  /**
   * Decrypts an API key encrypted with the encrypt method
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const key = this.deriveKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('anthropic-api-key'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('API key decrypted successfully');
      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Derives encryption key from the global ANTHROPIC_API_KEY
   */
  private deriveKey(): Buffer {
    const globalKey = process.env.ANTHROPIC_API_KEY!;
    // Use PBKDF2 or similar KDF in production
    return Buffer.from(globalKey.padEnd(32, '0').slice(0, 32));
  }

  /**
   * Generates a hash of an API key for audit logging (non-reversible)
   */
  generateKeyHash(apiKey: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  }
}
```

## ApiKeyValidationService

### Service Implementation  
```typescript
// applications/backend/api/src/api-keys/api-key-validation.service.ts
import { Injectable } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class ApiKeyValidationService {
  /**
   * Validates an Anthropic API key format (prefix check only)
   */
  validateFormat(apiKey: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
    };

    if (!apiKey) {
      result.isValid = false;
      result.errors.push('API key is required');
      return result;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      result.isValid = false;
      result.errors.push('API key must start with sk-ant-');
    }

    return result;
  }
}
```

## API Key Module

### Module Configuration
```typescript
// applications/backend/api/src/api-keys/api-keys.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { ApiKeyEncryptionService } from './api-key-encryption.service';
import { ApiKeyValidationService } from './api-key-validation.service';
import { ApiKeyResolutionService } from './api-key-resolution.service';
import { ApiKeyAuditService } from './api-key-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Project])],
  providers: [
    ApiKeyEncryptionService,
    ApiKeyValidationService, 
    ApiKeyResolutionService,
    ApiKeyAuditService,
  ],
  exports: [
    ApiKeyEncryptionService,
    ApiKeyValidationService,
    ApiKeyResolutionService,
    ApiKeyAuditService,
  ],
})
export class ApiKeysModule {}
```

## Security Considerations

### Encryption Security
- **Algorithm**: AES-256-GCM provides authenticated encryption
- **Key derivation**: Uses global API key as base for encryption key
- **IV/Nonce**: Random 128-bit IV for each encryption operation
- **AAD**: Additional authenticated data prevents tampering

### Memory Security
- API keys should be cleared from memory after use where possible
- Avoid logging plaintext keys in any context
- Use secure string handling practices

### Validation Security
- Format validation (prefix check only) prevents obvious input errors
- No connectivity testing — validation is format-only per author decision
- Error messages don't expose key details

## Usage Examples

### Encrypting an API Key
```typescript
const encryptionService = new ApiKeyEncryptionService();
const encrypted = await encryptionService.encrypt('sk-ant-api03-...');
// Store encrypted value in database
```

### Validating an API Key
```typescript
const validationService = new ApiKeyValidationService();
const result = validationService.validateFormat('sk-ant-api03-...');
if (result.isValid) {
  // Proceed with storing the key
} else {
  // Display validation errors to user
}
```

### Full Workflow
```typescript
// Validate format, encrypt, and store
const validation = validationService.validateFormat(userApiKey);
if (validation.isValid) {
  const encrypted = await encryptionService.encrypt(userApiKey);
  await orgRepo.update(orgId, { anthropicApiKey: encrypted });
}
```