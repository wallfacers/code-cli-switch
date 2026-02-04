import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateToml } from '../src/core/formats/toml.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('TOML Validator', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cs-cli-toml-test-'));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should validate valid bare keys with hyphens', () => {
    const file = join(tempDir, 'bare-keys.toml');
    const content = `my-key-123 = "value"
under_score = 1`;
    writeFileSync(file, content);
    const result = validateToml(file);
    expect(result.valid).toBe(true);
  });

  it('should validate valid quoted keys', () => {
    const file = join(tempDir, 'quoted-keys.toml');
    const content = `"quoted.key" = "value"
"key-with-dashes" = 123
'single-quoted' = true`;
    writeFileSync(file, content);
    const result = validateToml(file);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid keys', () => {
    const file = join(tempDir, 'invalid-keys.toml');
    writeFileSync(file, 'key with spaces = "value"');
    const result = validateToml(file);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid key format');
  });

  it('should validate user reported case', () => {
    const file = join(tempDir, 'user-case.toml');
    const content = `
model_provider = "duckcoding"
[notice]
"hide_gpt-5.1-codex-max_migration_prompt" = true
`;
    writeFileSync(file, content);
    const result = validateToml(file);
    expect(result.valid).toBe(true);
  });
});