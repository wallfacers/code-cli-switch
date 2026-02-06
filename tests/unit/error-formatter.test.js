import { describe, it, expect } from 'vitest';
import {
  formatVariantNotFoundError,
  formatValidationError
} from '../../src/utils/error-formatter.js';

describe('error formatter', () => {
  it('should format variant not found error', () => {
    const adapter = {
      getConfigDir: () => '/test/.claude',
      getVariantPath: (v) => `/test/.claude/settings.json.${v}`,
      scanVariants: () => [{ name: 'default' }, { name: 'local' }]
    };

    const result = formatVariantNotFoundError('claude', 'openai', adapter);

    expect(result.title).toBeTruthy();
    expect(result.details).toBeDefined();
    expect(result.suggestions).toBeDefined();
  });

  it('should format validation error', () => {
    const result = formatValidationError('/test/settings.json', {
      message: 'Unexpected token'
    });

    expect(result.title).toBeTruthy();
    expect(result.details).toBeDefined();
    expect(result.suggestions).toBeDefined();
  });
});
