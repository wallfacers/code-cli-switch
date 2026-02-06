import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { getConfigDir, getSettingsPath, getVariantPath, validateConfigDir } from '../src/utils/path.js';

describe('path utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should use CLAUDE_CONFIG_DIR when set', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '/custom/path');
    expect(getConfigDir()).toBe('/custom/path');
  });

  it('should return correct variant path', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '/test');
    expect(getVariantPath('openai')).toBe(path.join('/test', 'settings.json.openai'));
  });

  it('should return correct settings path', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '/test');
    expect(getSettingsPath()).toBe(path.join('/test', 'settings.json'));
  });
});
