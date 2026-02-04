import fs from 'node:fs';
import { getSettingsPath, getBackupPath, ensureBackupDir } from '../utils/path.js';
import { fileHash } from '../utils/hash.js';

/**
 * 生成备份文件名的时间戳
 * @returns {string}
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * 备份当前 settings.json
 * @returns {object} { success: boolean, path?: string, error?: string }
 */
export function createBackup() {
  const settingsPath = getSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    return { success: false, error: 'settings.json does not exist' };
  }

  try {
    ensureBackupDir();
    const timestamp = getTimestamp();
    const backupPath = getBackupPath(timestamp);

    fs.copyFileSync(settingsPath, backupPath);

    return { success: true, path: backupPath, timestamp };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 列出所有备份文件
 * @returns {Array}
 */
export function listBackups() {
  const backupDir = ensureBackupDir();
  const files = fs.readdirSync(backupDir);

  return files
    .filter(f => f.endsWith('.bak'))
    .map(f => {
      const match = f.match(/settings\.json\.(.+)\.bak/);
      return match ? { name: f, timestamp: match[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * 恢复备份
 * @param {string} timestamp - 备份时间戳
 * @returns {object}
 */
export function restoreBackup(timestamp) {
  const settingsPath = getSettingsPath();
  const backupDir = ensureBackupDir();
  const backupPath = `${backupDir}/settings.json.${timestamp}.bak`;

  if (!fs.existsSync(backupPath)) {
    return { success: false, error: 'Backup file not found' };
  }

  try {
    // 先备份当前配置
    const currentBackup = createBackup();

    fs.copyFileSync(backupPath, settingsPath);

    return {
      success: true,
      restoredFrom: timestamp,
      currentBackup: currentBackup.success ? currentBackup.timestamp : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 恢复最新备份
 * @returns {object}
 */
export function restoreLatestBackup() {
  const backups = listBackups();
  if (backups.length === 0) {
    return { success: false, error: 'No backups found' };
  }
  return restoreBackup(backups[0].timestamp);
}
