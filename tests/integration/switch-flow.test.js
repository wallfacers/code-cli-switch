import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { switchConfig } from '../../src/core/switcher.js';
import { ClaudeAdapter } from '../../src/core/services/claude.js';

describe('switch flow integration', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-switch-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = testDir;

    // Create profile directories with settings files
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('openai'), { recursive: true });
    fs.writeFileSync(
      adapter.getProfilePath('openai'),
      JSON.stringify({ api_key: 'sk-openai', model: 'gpt-4' })
    );
    fs.mkdirSync(adapter.getProfileDir('local'), { recursive: true });
    fs.writeFileSync(
      adapter.getProfilePath('local'),
      JSON.stringify({ api_key: 'sk-local', model: 'local' })
    );

    // Create global settings.json
    fs.writeFileSync(
      adapter.getTargetPath(),
      JSON.stringify({ api_key: 'sk-default', model: 'default' })
    );
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should switch configuration successfully with profile isolation', () => {
    const result = switchConfig('claude', 'openai');

    expect(result.success).toBe(true);
    expect(result.variant).toBe('openai');
    expect(result.exportCommand).toBeDefined();
    expect(result.exportCommand).toContain('CLAUDE_CONFIG_DIR');
  });

  it('should not modify global settings.json when using profile isolation', () => {
    const adapter = new ClaudeAdapter();
    const originalContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');

    switchConfig('claude', 'openai');

    const currentContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');
    expect(currentContent).toBe(originalContent);
  });

  it('should support dry-run mode', () => {
    const adapter = new ClaudeAdapter();
    const originalProfileContent = fs.readFileSync(adapter.getProfilePath('openai'), 'utf-8');

    const result = switchConfig('claude', 'openai', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);

    // Profile should not be modified in dry-run mode
    const currentProfileContent = fs.readFileSync(adapter.getProfilePath('openai'), 'utf-8');
    expect(currentProfileContent).toBe(originalProfileContent);
  });

  it('should handle non-existent variant', () => {
    const result = switchConfig('claude', 'nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should validate JSON format before switching', () => {
    // Create profile with invalid JSON
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('invalid'), { recursive: true });
    fs.writeFileSync(
      adapter.getProfilePath('invalid'),
      '{ invalid json }'
    );

    const result = switchConfig('claude', 'invalid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid format');
  });
});

describe('switch with profile isolation', () => {
  let tempDir;
  let originalHome;
  let originalConfigDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-isolation-test-'));
    originalHome = process.env.HOME;
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = tempDir;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (originalConfigDir) {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return export command on success', () => {
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), JSON.stringify({ vendor: 'glm' }));

    const result = switchConfig('claude', 'glm');

    expect(result.success).toBe(true);
    expect(result.exportCommand).toBeDefined();
    expect(result.exportCommand).toContain('CLAUDE_CONFIG_DIR');
    // Check for profile path (handle both forward and backslash for cross-platform)
    expect(result.profileDir).toContain('glm');
    expect(result.profileDir).toContain('profiles');
  });

  it('should not modify global settings.json', () => {
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), JSON.stringify({ vendor: 'glm' }));

    fs.writeFileSync(adapter.getTargetPath(), JSON.stringify({ vendor: 'claude' }));
    const originalContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');

    switchConfig('claude', 'glm');

    const currentContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');
    expect(currentContent).toBe(originalContent);
  });

  it('should auto-migrate legacy variant to profile', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'settings.json.glm'),
      JSON.stringify({ vendor: 'glm' })
    );

    const result = switchConfig('claude', 'glm');

    expect(result.success).toBe(true);
    expect(fs.existsSync(adapter.getProfilePath('glm'))).toBe(true);
  });

  it('should inject statusLine to profile settings', () => {
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), JSON.stringify({}));

    switchConfig('claude', 'glm');

    const profileContent = JSON.parse(fs.readFileSync(adapter.getProfilePath('glm'), 'utf-8'));
    expect(profileContent.statusLine).toBeDefined();
    expect(profileContent.statusLine.command).toContain('glm');
  });
});
