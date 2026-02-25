import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectShell,
  getShellConfigPath,
  updateShellConfig,
  generateExportCommand
} from '../../src/core/shell-config.js';

describe('shell-config', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectShell', () => {
    it('should detect zsh from SHELL env', () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/bin/zsh';
      expect(detectShell()).toBe('zsh');
      process.env.SHELL = originalShell;
    });

    it('should detect bash from SHELL env', () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/bin/bash';
      expect(detectShell()).toBe('bash');
      process.env.SHELL = originalShell;
    });

    it('should detect powershell from PSHOME env', () => {
      const originalPsHome = process.env.PSHOME;
      process.env.PSHOME = '/usr/local/microsoft/powershell';
      expect(detectShell()).toBe('powershell');
      process.env.PSHOME = originalPsHome;
    });
  });

  describe('getShellConfigPath', () => {
    it('should return .zshrc for zsh', () => {
      const configPath = getShellConfigPath('zsh');
      expect(configPath).toContain('.zshrc');
    });

    it('should return .bashrc or .bash_profile for bash', () => {
      const configPath = getShellConfigPath('bash');
      expect(configPath).toMatch(/\.bash(rc|_profile)/);
    });

    it('should return $PROFILE for powershell', () => {
      const configPath = getShellConfigPath('powershell');
      expect(configPath).toContain('Microsoft.PowerShell_profile.ps1');
    });
  });

  describe('generateExportCommand', () => {
    it('should generate export for unix shells', () => {
      const cmd = generateExportCommand('/home/user/.claude/profiles/glm', 'bash');
      expect(cmd).toBe('export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/glm"');
    });

    it('should generate $env for powershell', () => {
      const cmd = generateExportCommand('C:\\Users\\test\\.claude\\profiles\\glm', 'powershell');
      expect(cmd).toBe('$env:CLAUDE_CONFIG_DIR = "C:\\Users\\test\\.claude\\profiles\\glm"');
    });
  });

  describe('updateShellConfig', () => {
    it('should add new config block if not exists', () => {
      const configPath = path.join(tempDir, '.zshrc');
      fs.writeFileSync(configPath, '# existing content\n');

      updateShellConfig(configPath, '/home/user/.claude/profiles/glm', 'bash');

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('# cs-cli-auto-start');
      expect(content).toContain('export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/glm"');
      expect(content).toContain('# cs-cli-auto-end');
    });

    it('should update existing config block', () => {
      const configPath = path.join(tempDir, '.zshrc');
      fs.writeFileSync(configPath, `# existing
# cs-cli-auto-start
export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/old"
# cs-cli-auto-end
# more content`);

      updateShellConfig(configPath, '/home/user/.claude/profiles/glm', 'bash');

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/glm"');
      expect(content).not.toContain('profiles/old');
      expect(content).toContain('# more content');
    });

    it('should handle powershell format', () => {
      const configPath = path.join(tempDir, 'Microsoft.PowerShell_profile.ps1');
      fs.writeFileSync(configPath, '# existing content\n');

      updateShellConfig(configPath, 'C:\\Users\\test\\.claude\\profiles\\glm', 'powershell');

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('# cs-cli-auto-start');
      expect(content).toContain('$env:CLAUDE_CONFIG_DIR = "C:\\Users\\test\\.claude\\profiles\\glm"');
    });
  });
});
