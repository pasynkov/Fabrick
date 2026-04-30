import { Injectable } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class ApiKeyValidationService {
  validateFormat(apiKey: string): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [] };

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
