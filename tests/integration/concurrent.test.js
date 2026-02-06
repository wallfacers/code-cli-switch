import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { switchConfig } from '../../src/core/switcher.js';

describe('concurrent operations', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-concurrent-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = testDir;

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'settings.json'),
      JSON.stringify({ api_key: 'sk-default' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.openai'),
      JSON.stringify({ api_key: 'sk-openai' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.local'),
      JSON.stringify({ api_key: 'sk-local' })
    );
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle concurrent switches safely', async () => {
    const switches = [
      switchConfig('claude', 'openai'),
      switchConfig('claude', 'local'),
      switchConfig('claude', 'openai')
    ];

    const results = await Promise.allSettled(switches);

    // 所有操作都应该成功（进程隔离）
    results.forEach(result => {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expect(result.value.success).toBe(true);
      }
    });
  });
});
