import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexAdapter } from '../src/core/services/codex.js';

describe('Codex auth.json', () => {
  let tempDir;
  let adapter;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cs-cli-codex-test-'));
    adapter = new CodexAdapter();
    // 覆盖 getConfigDir 方法使用临时目录
    adapter.getConfigDir = () => tempDir;
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create auth.json with OPENAI_API_KEY from env_key', () => {
    const configPath = join(tempDir, 'config.toml');
    const tomlContent = `model_provider = "test"
env_key = "sk-test-api-key-12345"`;
    writeFileSync(configPath, tomlContent);

    const result = adapter.updateAuthJson(configPath);

    expect(result.success).toBe(true);

    const authJsonPath = adapter.getAuthJsonPath();
    expect(existsSync(authJsonPath)).toBe(true);

    const authContent = readFileSync(authJsonPath, 'utf-8');
    const authData = JSON.parse(authContent);
    expect(authData.OPENAI_API_KEY).toBe('sk-test-api-key-12345');
  });

  it('should update existing auth.json', () => {
    // 先创建一个已存在的 auth.json
    const authJsonPath = adapter.getAuthJsonPath();
    writeFileSync(authJsonPath, JSON.stringify({ OPENAI_API_KEY: 'old-key', other_field: 'keep' }));

    const configPath = join(tempDir, 'config.toml.new');
    const tomlContent = `env_key = "sk-new-api-key-67890"`;
    writeFileSync(configPath, tomlContent);

    const result = adapter.updateAuthJson(configPath);

    expect(result.success).toBe(true);

    const authContent = readFileSync(authJsonPath, 'utf-8');
    const authData = JSON.parse(authContent);
    expect(authData.OPENAI_API_KEY).toBe('sk-new-api-key-67890');
    expect(authData.other_field).toBe('keep'); // 保留其他字段
  });

  it('should return error when env_key not found', () => {
    const configPath = join(tempDir, 'config-no-key.toml');
    const tomlContent = `model_provider = "test"
some_other_field = "value"`;
    writeFileSync(configPath, tomlContent);

    const result = adapter.updateAuthJson(configPath);

    expect(result.success).toBe(false);
    expect(result.error).toContain('env_key');
  });

  it('should handle nested env_key', () => {
    const configPath = join(tempDir, 'config-nested.toml');
    const tomlContent = `[env]
key = "sk-nested-key-111"`;
    writeFileSync(configPath, tomlContent);

    const result = adapter.updateAuthJson(configPath);

    expect(result.success).toBe(true);

    const authJsonPath = adapter.getAuthJsonPath();
    const authContent = readFileSync(authJsonPath, 'utf-8');
    const authData = JSON.parse(authContent);
    expect(authData.OPENAI_API_KEY).toBe('sk-nested-key-111');
  });
});
