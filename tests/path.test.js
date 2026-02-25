import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { getConfigDir, getSettingsPath, getVariantPath } from '../src/utils/path.js';

describe('path utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return default config directory', () => {
    const configDir = getConfigDir();
    const platform = os.platform();
    if (platform === 'win32') {
      expect(configDir).toBe(path.join(process.env.USERPROFILE || '', '.claude'));
    } else {
      expect(configDir).toBe(path.join(os.homedir(), '.claude'));
    }
  });

  it('should return correct settings path', () => {
    const settingsPath = getSettingsPath();
    expect(settingsPath).toContain('settings.json');
  });

  it('should return correct variant path', () => {
    const variantPath = getVariantPath('openai');
    expect(variantPath).toContain('settings.json.openai');
  });
});
