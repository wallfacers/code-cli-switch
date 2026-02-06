import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { switchConfig } from '../../src/core/switcher.js';

describe('switch flow integration', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-switch-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = testDir;

    // 创建测试配置文件
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'settings.json'),
      JSON.stringify({ api_key: 'sk-default', model: 'default' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.openai'),
      JSON.stringify({ api_key: 'sk-openai', model: 'gpt-4' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.local'),
      JSON.stringify({ api_key: 'sk-local', model: 'local' })
    );
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should switch configuration successfully', () => {
    const result = switchConfig('claude', 'openai');

    expect(result.success).toBe(true);
    expect(result.variant).toBe('openai');

    const currentContent = fs.readFileSync(path.join(testDir, 'settings.json'), 'utf-8');
    const currentData = JSON.parse(currentContent);
    expect(currentData.api_key).toBe('sk-openai');
  });

  it('should create backup before switching', () => {
    const result = switchConfig('claude', 'openai');

    expect(result.success).toBe(true);
    expect(result.backup).toBeTruthy();

    // 检查备份目录
    const backupDir = path.join(testDir, 'backups');
    expect(fs.existsSync(backupDir)).toBe(true);
  });

  it('should support dry-run mode', () => {
    const result = switchConfig('claude', 'openai', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);

    // 配置不应改变
    const currentContent = fs.readFileSync(path.join(testDir, 'settings.json'), 'utf-8');
    const currentData = JSON.parse(currentContent);
    expect(currentData.api_key).toBe('sk-default');
  });

  it('should handle non-existent variant', () => {
    const result = switchConfig('claude', 'nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should validate JSON format before switching', () => {
    // 创建无效的 JSON 文件
    fs.writeFileSync(
      path.join(testDir, 'settings.json.invalid'),
      '{ invalid json }'
    );

    const result = switchConfig('claude', 'invalid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid format');
  });
});
