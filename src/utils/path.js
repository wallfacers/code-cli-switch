import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

/**
 * 解析 Claude 配置目录路径
 * 优先级: CLAUDE_CONFIG_DIR > 默认路径
 */
export function getConfigDir() {
  const envPath = process.env.CLAUDE_CONFIG_DIR;
  if (envPath) {
    return envPath;
  }

  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(process.env.USERPROFILE || '', '.claude');
  }
  return path.join(os.homedir(), '.claude');
}

/**
 * 获取 settings.json 路径
 */
export function getSettingsPath() {
  return path.join(getConfigDir(), 'settings.json');
}

/**
 * 获取候选配置文件路径
 * @param {string} variant - 配置变体名称
 */
export function getVariantPath(variant) {
  return path.join(getConfigDir(), `settings.json.${variant}`);
}

/**
 * 获取 state.json 路径
 */
export function getStatePath() {
  return path.join(getConfigDir(), 'state.json');
}

/**
 * 获取备份目录路径
 */
export function getBackupDir() {
  return path.join(getConfigDir(), 'backups');
}

/**
 * 获取备份文件路径
 * @param {string} timestamp - 时间戳
 */
export function getBackupPath(timestamp) {
  return path.join(getBackupDir(), `settings.json.${timestamp}.bak`);
}

/**
 * 验证配置目录是否存在
 * @returns {boolean}
 */
export function validateConfigDir() {
  const dir = getConfigDir();
  return fs.existsSync(dir);
}

/**
 * 确保备份目录存在
 */
export function ensureBackupDir() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
