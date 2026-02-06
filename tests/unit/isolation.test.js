import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getSessionDir, isolatedOperation, cleanupSession } from '../../src/core/isolation.js';

describe('process isolation', () => {
  afterEach(() => {
    cleanupSession();
  });

  it('should create and return session directory', () => {
    const sessionDir = getSessionDir();

    expect(sessionDir).toBeTruthy();
    expect(fs.existsSync(sessionDir)).toBe(true);
    expect(sessionDir).toContain('cs-cli-session-');
  });

  it('should return same session directory on multiple calls', () => {
    const dir1 = getSessionDir();
    const dir2 = getSessionDir();

    expect(dir1).toBe(dir2);
  });

  it('should create service-specific work directory', () => {
    const workDir = isolatedOperation('claude', (dir) => {
      expect(fs.existsSync(dir)).toBe(true);
      expect(dir).toContain('claude');
      return dir;
    });

    expect(workDir).toContain('claude');
  });

  it('should execute operation in isolated directory', () => {
    const testFile = isolatedOperation('test', (dir) => {
      const filePath = path.join(dir, 'test.txt');
      fs.writeFileSync(filePath, 'test content');
      return filePath;
    });

    expect(fs.existsSync(testFile)).toBe(true);
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('test content');
  });

  it('should clean up session directory', () => {
    const sessionDir = getSessionDir();
    expect(fs.existsSync(sessionDir)).toBe(true);

    cleanupSession();

    expect(fs.existsSync(sessionDir)).toBe(false);
  });
});
