import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set CLAUDE_CONFIG_DIR to avoid needing to mock os.homedir
const originalEnv = process.env.CLAUDE_CONFIG_DIR;
beforeEach(() => {
  process.env.CLAUDE_CONFIG_DIR = join(tmpdir(), 'mock-claude-config');
});

afterEach(() => {
  if (originalEnv !== undefined) {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
  } else {
    delete process.env.CLAUDE_CONFIG_DIR;
  }
});

import { getHookSourcePath, getHookTargetPath, installHook, checkAndInstall } from '../src/core/installer.js';

describe('installer', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cs-cli-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should return correct source path', () => {
    const sourcePath = getHookSourcePath();
    expect(sourcePath).toContain('hooks');
    expect(sourcePath).toContain('block-user-settings-change.js');
    expect(fs.existsSync(sourcePath)).toBe(true);
  });

  it('should return correct target path', () => {
    // Use default path (.claude) by not setting CLAUDE_CONFIG_DIR
    delete process.env.CLAUDE_CONFIG_DIR;
    const targetPath = getHookTargetPath();
    expect(targetPath).toContain('.claude');
    expect(targetPath).toContain('hooks');
  });

  it('should install when target does not exist', async () => {
    // Set a temp config dir
    const testConfigDir = join(tempDir, '.claude');
    process.env.CLAUDE_CONFIG_DIR = testConfigDir;

    const result = await checkAndInstall();

    expect(result.success).toBe(true);
    expect(fs.existsSync(result.path)).toBe(true);
    // Clean up
    if (fs.existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('should update when content differs', async () => {
    const testConfigDir = join(tempDir, '.claude');
    const targetDir = join(testConfigDir, 'hooks');
    const targetPath = join(targetDir, 'block-user-settings-change.js');

    // Create target dir and file with different content
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetPath, 'different content');

    process.env.CLAUDE_CONFIG_DIR = testConfigDir;

    const result = await checkAndInstall();

    expect(result.success).toBe(true);
    expect(fs.existsSync(result.path)).toBe(true);
    // Clean up
    if (fs.existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('should skip when content same', async () => {
    const sourceContent = fs.readFileSync(getHookSourcePath(), 'utf8');

    const testConfigDir = join(tempDir, '.claude');
    const targetDir = join(testConfigDir, 'hooks');
    const targetPath = join(targetDir, 'block-user-settings-change.js');

    // Create target dir and file with same content
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetPath, sourceContent);

    process.env.CLAUDE_CONFIG_DIR = testConfigDir;

    const result = await checkAndInstall();

    expect(result.success).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.reason).toBe('content unchanged');
    // Clean up
    if (fs.existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });
});
