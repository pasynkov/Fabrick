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
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ApiKeyValidationService {
  private readonly logger = new Logger(ApiKeyValidationService.name);

  /**
   * Validates an Anthropic API key format
   */
  validateFormat(apiKey: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check basic format
    if (!apiKey) {
      result.isValid = false;
      result.errors.push('API key is required');
      return result;
    }

    // Check Anthropic API key prefix
    if (!apiKey.startsWith('sk-ant-')) {
      result.isValid = false;
      result.errors.push('API key must start with sk-ant-');
    }

    // Check approximate length (Anthropic keys are typically 50-100 characters)
    if (apiKey.length < 20) {
      result.isValid = false;
      result.errors.push('API key appears too short');
    }

    if (apiKey.length > 200) {
      result.warnings.push('API key appears unusually long');
    }

    // Check for valid characters (base64-like pattern after prefix)
    const keyBody = apiKey.slice(7); // Remove 'sk-ant-' prefix
    const validPattern = /^[A-Za-z0-9\-_]+$/;
    if (!validPattern.test(keyBody)) {
      result.isValid = false;
      result.errors.push('API key contains invalid characters');
    }

    return result;
  }

  /**
   * Performs a connectivity test with the API key (optional validation)
   */
  async validateConnectivity(apiKey: string): Promise<ValidationResult> {
    const formatResult = this.validateFormat(apiKey);
    if (!formatResult.isValid) {
      return formatResult;
    }

    try {
      const client = new Anthropic({ apiKey });
      
      // Make a minimal API call to verify the key works
      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });

      if (response && response.content) {
        this.logger.debug('API key connectivity test successful');
        return {
          isValid: true,
          errors: [],
          warnings: [],
        };
      } else {
        return {
          isValid: false,
          errors: ['API key test call returned unexpected response'],
          warnings: [],
        };
      }
    } catch (error: any) {
      this.logger.warn(`API key connectivity test failed: ${error.message}`);
      
      let errorMessage = 'API key test failed';
      if (error.status === 401) {
        errorMessage = 'API key is invalid or unauthorized';
      } else if (error.status === 429) {
        errorMessage = 'API key rate limited (but appears valid)';
        return {
          isValid: true,
          errors: [],
          warnings: [errorMessage],
        };
      }

      return {
        isValid: false,
        errors: [errorMessage],
        warnings: [],
      };
    }
  }

  /**
   * Full validation: format + optional connectivity test
   */
  async validate(apiKey: string, testConnectivity = false): Promise<ValidationResult> {
    const formatResult = this.validateFormat(apiKey);
    
    if (!formatResult.isValid || !testConnectivity) {
      return formatResult;
    }

    const connectivityResult = await this.validateConnectivity(apiKey);
    
    return {
      isValid: formatResult.isValid && connectivityResult.isValid,
      errors: [...formatResult.errors, ...connectivityResult.errors],
      warnings: [...formatResult.warnings, ...connectivityResult.warnings],
    };
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
- Format validation prevents obvious input errors
- Connectivity testing is optional to avoid unnecessary API calls
- Rate limiting considerations for validation testing
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
const result = await validationService.validate('sk-ant-api03-...', true);
if (result.isValid) {
  // Proceed with storing the key
} else {
  // Display validation errors to user
}
```

### Full Workflow
```typescript
// Validate, encrypt, and store
const validation = await validationService.validate(userApiKey);
if (validation.isValid) {
  const encrypted = await encryptionService.encrypt(userApiKey);
  await orgRepo.update(orgId, { anthropicApiKey: encrypted });
}
```