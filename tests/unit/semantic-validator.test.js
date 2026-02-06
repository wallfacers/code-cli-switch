import { describe, it, expect } from 'vitest';
import {
  validateClaudeSemantic,
  validateGeminiSemantic,
  validateCodexSemantic,
  validateSemantic
} from '../../src/core/semantic-validator.js';

describe('semantic validation', () => {
  describe('Claude config', () => {
    it('should validate config with api_key', () => {
      const result = validateClaudeSemantic({
        api_key: 'sk-ant-test',
        model: 'claude-sonnet-4'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate config with providers', () => {
      const result = validateClaudeSemantic({
        providers: [{ name: 'openai', api_key: 'sk-test' }]
      });
      expect(result.valid).toBe(true);
    });

    it('should reject config without api_key or providers', () => {
      const result = validateClaudeSemantic({
        model: 'claude-sonnet-4'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: api_key or providers');
    });

    it('should reject invalid model type', () => {
      const result = validateClaudeSemantic({
        api_key: 'sk-ant-test',
        model: 123
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "model" must be a string');
    });
  });

  describe('Gemini config', () => {
    it('should validate config with GEMINI_API_KEY', () => {
      const result = validateGeminiSemantic({
        GEMINI_API_KEY: 'AIza-test'
      });
      expect(result.valid).toBe(true);
    });

    it('should validate config with API_KEY', () => {
      const result = validateGeminiSemantic({
        API_KEY: 'AIza-test'
      });
      expect(result.valid).toBe(true);
    });

    it('should reject config without API key', () => {
      const result = validateGeminiSemantic({
        MODEL: 'gemini-pro'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: GEMINI_API_KEY or API_KEY');
    });
  });

  describe('Codex config', () => {
    it('should validate config with env_key', () => {
      const result = validateCodexSemantic({
        env_key: 'sk-test',
        base_url: 'https://api.openai.com/v1'
      });
      expect(result.valid).toBe(true);
    });

    it('should validate config with api_key', () => {
      const result = validateCodexSemantic({
        api_key: 'sk-test'
      });
      expect(result.valid).toBe(true);
    });

    it('should reject config without env_key or api_key', () => {
      const result = validateCodexSemantic({
        base_url: 'https://api.openai.com/v1'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: env_key or api_key');
    });
  });

  describe('validateSemantic unified function', () => {
    it('should delegate to correct validator for claude', () => {
      const result = validateSemantic('claude', { api_key: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should delegate to correct validator for gemini', () => {
      const result = validateSemantic('gemini', { GEMINI_API_KEY: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should delegate to correct validator for codex', () => {
      const result = validateSemantic('codex', { env_key: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should return valid for unknown service', () => {
      const result = validateSemantic('unknown', {});
      expect(result.valid).toBe(true);
    });
  });
});
