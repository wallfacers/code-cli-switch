/**
 * Shell configuration persistence module
 * Handles detection and modification of shell config files for profile isolation
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Markers for auto-generated config blocks
const MARKER_START = '# cs-cli-auto-start';
const MARKER_END = '# cs-cli-auto-end';

/**
 * Detect current shell type
 * @returns {'zsh'|'bash'|'powershell'|'cmd'|'unknown'} Shell type
 */
export function detectShell() {
  // Check for PowerShell (works on Windows, Linux, macOS)
  if (process.env.PSHOME) {
    return 'powershell';
  }

  // Check SHELL environment variable (Unix-like systems)
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) {
    return 'zsh';
  }
  if (shell.includes('bash')) {
    return 'bash';
  }

  // Windows CMD check
  if (process.platform === 'win32' && !process.env.PSHOME) {
    const comSpec = process.env.ComSpec || '';
    if (comSpec.toLowerCase().includes('cmd')) {
      return 'cmd';
    }
    // Default to PowerShell on Windows if ComSpec is not cmd
    return 'powershell';
  }

  return 'unknown';
}

/**
 * Get shell config file path
 * @param {string} shellType - Shell type (zsh, bash, powershell, cmd)
 * @returns {string} Path to shell config file
 */
export function getShellConfigPath(shellType) {
  const homeDir = os.homedir();

  switch (shellType) {
    case 'zsh':
      return path.join(homeDir, '.zshrc');
    case 'bash':
      // Try .bashrc first, fall back to .bash_profile
      const bashrc = path.join(homeDir, '.bashrc');
      if (fs.existsSync(bashrc)) {
        return bashrc;
      }
      return path.join(homeDir, '.bash_profile');
    case 'powershell':
      // PowerShell $PROFILE path
      // On Windows: Documents\PowerShell\Microsoft.PowerShell_profile.ps1
      // On Unix: .config/powershell/Microsoft.PowerShell_profile.ps1
      if (process.platform === 'win32') {
        return path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
      }
      return path.join(homeDir, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
    case 'cmd':
      // CMD doesn't have a profile file, return null
      return null;
    default:
      return null;
  }
}

/**
 * Generate export command for setting CLAUDE_CONFIG_DIR
 * @param {string} configDir - Configuration directory path
 * @param {string} shellType - Shell type
 * @returns {string} Export command string
 */
export function generateExportCommand(configDir, shellType) {
  switch (shellType) {
    case 'zsh':
    case 'bash':
      return `export CLAUDE_CONFIG_DIR="${configDir}"`;
    case 'powershell':
      return `$env:CLAUDE_CONFIG_DIR = "${configDir}"`;
    case 'cmd':
      return `set CLAUDE_CONFIG_DIR=${configDir}`;
    default:
      return `export CLAUDE_CONFIG_DIR="${configDir}"`;
  }
}

/**
 * Update shell config file with new CLAUDE_CONFIG_DIR setting
 * Uses markers to identify and update the auto-generated block
 * @param {string} configPath - Path to shell config file
 * @param {string} configDir - Configuration directory path
 * @param {string} shellType - Shell type
 */
export function updateShellConfig(configPath, configDir, shellType) {
  // Read existing content or create empty
  let content = '';
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf-8');
  }

  const exportCmd = generateExportCommand(configDir, shellType);

  // Check if markers exist
  const startIndex = content.indexOf(MARKER_START);
  const endIndex = content.indexOf(MARKER_END);

  // Build new config block
  const newBlock = `${MARKER_START}
${exportCmd}
${MARKER_END}`;

  let newContent;

  if (startIndex !== -1 && endIndex !== -1) {
    // Update existing block
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + MARKER_END.length);
    newContent = before + newBlock + after;
  } else {
    // Add new block at the end
    // Ensure there's a newline before the block if content doesn't end with one
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    newContent = content + separator + '\n' + newBlock + '\n';
  }

  // Ensure parent directory exists
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, newContent, 'utf-8');
}

/**
 * Remove auto-generated config block from shell config
 * @param {string} configPath - Path to shell config file
 */
export function removeShellConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return;
  }

  let content = fs.readFileSync(configPath, 'utf-8');

  const startIndex = content.indexOf(MARKER_START);
  const endIndex = content.indexOf(MARKER_END);

  if (startIndex !== -1 && endIndex !== -1) {
    // Remove the block including surrounding newlines
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + MARKER_END.length);

    // Clean up extra newlines
    let newContent = before + after;
    // Remove excessive blank lines
    newContent = newContent.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(configPath, newContent, 'utf-8');
  }
}
