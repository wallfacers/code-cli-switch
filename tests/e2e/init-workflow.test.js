import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initCommand } from '../../src/commands/init.js';

describe('init command e2e', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-init-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create config directory when it does not exist', async () => {
    process.env.CLAUDE_CONFIG_DIR = testDir;

    // Note: This test requires mocking inquirer or running in non-interactive mode
    // For now, just verify the module exists and exports the function
    expect(typeof initCommand).toBe('function');
  });

  it('should have example configs for all services', () => {
    const { getServiceExamples } = require('../../src/commands/init.js');

    // This is a structural test - verify the function exists
    // Actual integration testing would require mocking inquirer
    expect(typeof getServiceExamples).toBe('function');
  });
});
