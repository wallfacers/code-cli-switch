import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { undoSwitch, getHistory } from '../../src/core/history.js';
import { createBackup } from '../../src/core/backup.js';

describe('history and undo', () => {
  let testDir;
  let originalHome;
  let originalUserProfile;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-history-'));
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    // Set both HOME and USERPROFILE for cross-platform compatibility
    process.env.HOME = testDir;
    process.env.USERPROFILE = testDir;

    // 创建配置目录和配置文件（createBackup 需要目标文件存在）
    // ClaudeAdapter 期望文件名为 settings.json
    const configDir = path.join(testDir, '.claude');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(path.join(configDir, '.cs-backups'), { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'settings.json'),
      JSON.stringify({ test: 'config' })
    );

    // Mock console.warn to avoid noise in test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
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
