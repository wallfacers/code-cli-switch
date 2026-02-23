import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { injectStatusLine } from '../../src/core/statusline.js';

describe('statusline inject', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cs-cli-statusline-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should inject statusLine into settings.json', () => {
    const settingsPath = join(tempDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ model: 'test' }, null, 2));

    const result = injectStatusLine(settingsPath, 'glm');
    expect(result.success).toBe(true);

    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.statusLine).toBeDefined();
    expect(updated.statusLine.type).toBe('command');
    expect(updated.statusLine.command).toContain('glm');
    expect(updated.statusLine.padding).toBe(0);
  });

  it('should preserve existing config', () => {
    const settingsPath = join(tempDir, 'settings.json');
    const originalConfig = {
      model: 'test',
      env: { API_KEY: 'secret' }
    };
    writeFileSync(settingsPath, JSON.stringify(originalConfig, null, 2));

    injectStatusLine(settingsPath, 'kimi');

    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.model).toBe('test');
    expect(updated.env.API_KEY).toBe('secret');
  });

  it('should return error for non-existent file', () => {
    const result = injectStatusLine(join(tempDir, 'not-exist.json'), 'glm');
    expect(result.success).toBe(false);
    expect(result.error).toBe('File not found');
  });
});
