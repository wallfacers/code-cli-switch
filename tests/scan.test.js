import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceAdapter } from '../src/core/services/base.js';
import { ClaudeAdapter } from '../src/core/services/claude.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

class TestAdapter extends ServiceAdapter {
  constructor(configDir) {
    super();
    this.id = 'test';
    this.name = 'Test';
    this.extension = 'json';
    this.configDir = configDir;
  }
  getConfigDir() { return this.configDir; }
  getTargetPath() { return path.join(this.configDir, 'config.json'); }
  getVariantPath(variant) { return path.join(this.configDir, `config.json.${variant}`); }
  getVariantPattern() { return /^config\.json\.(.+)$/; }
  extractVariantName(filename) { 
    const match = filename.match(/^config\.json\.(.+)$/);
    return match ? match[1] : null;
  }
}

describe('ServiceAdapter.scanVariants', () => {
  let tempDir;
  let adapter;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'cs-cli-scan-test-'));
    adapter = new TestAdapter(tempDir);
    mkdirSync(path.join(tempDir, 'backups'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should identify active variant by hash', () => {
    const variantPath = path.join(tempDir, 'config.json.v1');
    const targetPath = path.join(tempDir, 'config.json');
    writeFileSync(variantPath, 'content');
    writeFileSync(targetPath, 'content');

    const variants = adapter.scanVariants();
    expect(variants).toHaveLength(1);
    expect(variants[0].name).toBe('v1');
    expect(variants[0].active).toBe(true);
  });

  it('should identify current variant by state when hash differs', () => {
    const variantPath = path.join(tempDir, 'config.json.v1');
    const targetPath = path.join(tempDir, 'config.json');
    
    // Different content
    writeFileSync(variantPath, 'content-variant');
    writeFileSync(targetPath, 'content-target');
    
    // Write state
    adapter.writeState('v1', 'somehash');

    const variants = adapter.scanVariants();
    expect(variants).toHaveLength(1);
    expect(variants[0].name).toBe('v1');
    expect(variants[0].active).toBe(false); // Hash differs
    expect(variants[0].current).toBe(true); // Matches state
  });

  it('should prioritize active (hash match) over sorting', () => {
    const v1Path = path.join(tempDir, 'config.json.a');
    const v2Path = path.join(tempDir, 'config.json.b');
    const targetPath = path.join(tempDir, 'config.json');

    writeFileSync(v1Path, 'content-a');
    writeFileSync(v2Path, 'content-b');
    writeFileSync(targetPath, 'content-b'); // Matches b

    const variants = adapter.scanVariants();
    expect(variants[0].name).toBe('b'); // Active comes first
    expect(variants[0].active).toBe(true);
    expect(variants[1].name).toBe('a');
  });

  it('should prioritize current (state match) if no hash match', () => {
    const v1Path = path.join(tempDir, 'config.json.a');
    const v2Path = path.join(tempDir, 'config.json.b');
    const targetPath = path.join(tempDir, 'config.json');

    writeFileSync(v1Path, 'content-a');
    writeFileSync(v2Path, 'content-b');
    writeFileSync(targetPath, 'content-modified');

    adapter.writeState('b', 'somehash');

    const variants = adapter.scanVariants();
    // Logic in scanVariants sorts active first, then current first
    expect(variants[0].name).toBe('b');
    expect(variants[0].current).toBe(true);
    expect(variants[1].name).toBe('a');
  });
});

describe('ClaudeAdapter profiles support', () => {
  let tempDir;
  let originalHome;
  let originalUserProfile;
  let originalConfigDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'claude-cfg-test-'));
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir; // For Windows
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (originalUserProfile) {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
    if (originalConfigDir) {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should get profiles directory', () => {
    const adapter = new ClaudeAdapter();
    const profilesDir = adapter.getProfilesDir();
    expect(profilesDir).toContain('profiles');
  });

  it('should get profile path', () => {
    const adapter = new ClaudeAdapter();
    const profilePath = adapter.getProfilePath('glm');
    expect(profilePath).toContain('profiles');
    expect(profilePath).toContain('glm');
    expect(profilePath).toContain('settings.json');
  });

  it('should check if profiles initialized', () => {
    const adapter = new ClaudeAdapter();
    expect(adapter.profilesInitialized()).toBe(false);

    mkdirSync(adapter.getProfilesDir(), { recursive: true });
    expect(adapter.profilesInitialized()).toBe(true);
  });

  it('should migrate legacy variant to profiles', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      path.join(configDir, 'settings.json.glm'),
      JSON.stringify({ test: true })
    );

    const result = adapter.migrateVariantToProfile('glm');

    expect(result.success).toBe(true);
    expect(existsSync(adapter.getProfilePath('glm'))).toBe(true);
    expect(existsSync(path.join(configDir, 'settings.json.glm'))).toBe(true);
  });

  it('should return profile path when it exists', () => {
    const adapter = new ClaudeAdapter();

    mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    writeFileSync(adapter.getProfilePath('glm'), '{}');

    const variantPath = adapter.getVariantPath('glm');
    expect(variantPath).toContain('profiles');
    expect(variantPath).toContain('glm');
  });

  it('should fallback to legacy path when profile not exists but legacy exists', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      path.join(configDir, 'settings.json.claude'),
      JSON.stringify({ test: true })
    );

    const variantPath = adapter.getVariantPath('claude');
    expect(variantPath).toContain('settings.json.claude');
    expect(variantPath).not.toContain('profiles');
  });

  it('should scan both profiles and legacy variants', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    writeFileSync(adapter.getProfilePath('glm'), '{}');

    writeFileSync(
      path.join(configDir, 'settings.json.work'),
      JSON.stringify({})
    );

    const variants = adapter.scanVariants();
    const names = variants.map(v => v.name);

    expect(names).toContain('glm');
    expect(names).toContain('work');
  });
});
