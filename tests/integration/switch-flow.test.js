import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { switchConfig } from '../../src/core/switcher.js';
import { ClaudeAdapter } from '../../src/core/services/claude.js';

describe('switch flow integration', () => {
  let testDir;
  let originalHome;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-switch-'));
    originalHome = process.env.HOME;
    process.env.HOME = testDir;
    delete process.env.CLAUDE_CONFIG_DIR;

    // Create adapter and setup test files
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();
    fs.mkdirSync(configDir, { recursive: true });

    // Create variant files
    fs.writeFileSync(
      path.join(configDir, 'settings.json.openai'),
      JSON.stringify({ api_key: 'sk-openai', model: 'gpt-4' })
    );
    fs.writeFileSync(
      path.join(configDir, 'settings.json.local'),
      JSON.stringify({ api_key: 'sk-local', model: 'local' })
    );

    // Create global settings.json
    fs.writeFileSync(
      adapter.getTargetPath(),
      JSON.stringify({ api_key: 'sk-default', model: 'default' })
    );
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should switch configuration successfully', () => {
    const result = switchConfig('claude', 'openai');

    expect(result.success).toBe(true);
    expect(result.variant).toBe('openai');
    expect(result.message).toContain('openai');
  });

  it('should modify global settings.json when switching', () => {
    const adapter = new ClaudeAdapter();

    switchConfig('claude', 'openai');

    const currentContent = JSON.parse(fs.readFileSync(adapter.getTargetPath(), 'utf-8'));
    expect(currentContent.api_key).toBe('sk-openai');
    expect(currentContent.model).toBe('gpt-4');
  });

  it('should support dry-run mode', () => {
    const adapter = new ClaudeAdapter();
    const originalContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');

    const result = switchConfig('claude', 'openai', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);

    // settings.json should not be modified in dry-run mode
    const currentContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');
    expect(currentContent).toBe(originalContent);
  });

  it('should handle non-existent variant', () => {
    const result = switchConfig('claude', 'nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should validate JSON format before switching', () => {
    const adapter = new ClaudeAdapter();
    fs.writeFileSync(
      path.join(adapter.getConfigDir(), 'settings.json.invalid'),
      '{ invalid json }'
    );

    const result = switchConfig('claude', 'invalid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid format');
  });

  it('should create backup when switching', () => {
    const result = switchConfig('claude', 'openai');

    expect(result.success).toBe(true);
    expect(result.backup).toBeDefined();
  });
});
