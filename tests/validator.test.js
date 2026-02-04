import { describe, it, expect, vi, beforeAll } from 'vitest';
import { validateJson, fileExists } from '../src/core/validator.js';
import fs from 'node:fs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('validator', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cs-cli-test-'));
  });

  it('should validate valid JSON', () => {
    const validFile = join(tempDir, 'valid.json');
    writeFileSync(validFile, '{"test": true}');
    const result = validateJson(validFile);
    expect(result.valid).toBe(true);
    expect(result.data.test).toBe(true);
  });

  it('should reject invalid JSON', () => {
    const invalidFile = join(tempDir, 'invalid.json');
    writeFileSync(invalidFile, '{"test": broken}');
    const result = validateJson(invalidFile);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should check file existence', () => {
    const existingFile = join(tempDir, 'exists.json');
    writeFileSync(existingFile, '{}');
    expect(fileExists(existingFile)).toBe(true);
    expect(fileExists(join(tempDir, 'not-exist.json'))).toBe(false);
  });
});
