import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { undoSwitch, getHistory } from '../../src/core/history.js';
import { createBackup } from '../../src/core/backup.js';

describe('history and undo', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-history-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = testDir;

    // 创建配置目录和配置文件（createBackup 需要目标文件存在）
    // ClaudeAdapter 期望文件名为 settings.json
    fs.mkdirSync(path.join(testDir, '.cs-backups'), { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'settings.json'),
      JSON.stringify({ test: 'config' })
    );

    // Mock console.warn to avoid noise in test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should return error when no backups exist', () => {
    const result = undoSwitch('claude');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No previous backup');
  });

  it('should return error when only one backup exists', () => {
    createBackup('claude');

    const result = undoSwitch('claude');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No previous backup');
  });

  it('should get history from backups', () => {
    createBackup('claude');

    const history = getHistory('claude', 10);

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });
});
