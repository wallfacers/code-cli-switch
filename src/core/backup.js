import fs from 'node:fs';
import { getAdapter } from './registry.js';
import { formatTimestamp } from '../utils/date.js';

/**
 * 备份指定服务的当前配置
 * @param {string} service - 服务标识，默认为 claude
 * @returns {object} { success: boolean, path?: string, error?: string, timestamp?: string }
 */
export function createBackup(service = 'claude') {
  const adapter = getAdapter(service);
  if (!adapter) {
    return { success: false, error: `Unknown service: "${service}"` };
  }

  const targetPath = adapter.getTargetPath();

  if (!fs.existsSync(targetPath)) {
    return { success: false, error: `${adapter.getBaseName()} does not exist` };
  }

  try {
    adapter.ensureBackupDir();
    const timestamp = formatTimestamp();
    const backupPath = adapter.getBackupPath(timestamp);

    fs.copyFileSync(targetPath, backupPath);

    return { success: true, path: backupPath, timestamp };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 列出指定服务的所有备份文件
 * @param {string} service - 服务标识，默认为 claude
 * @returns {Array<{name: string, timestamp: string, path: string}>}
 */
export function listBackups(service = 'claude') {
  const adapter = getAdapter(service);
  if (!adapter) {
    return [];
  }

  const backupDir = adapter.ensureBackupDir();

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir);
  const baseName = adapter.getBaseName();
  const extension = adapter.extension || 'bak';

  const pattern = new RegExp(`^${escapeRegExp(baseName)}\\.(.+)\\.${extension}$`);

  return files
    .map(f => {
      const match = f.match(pattern);
      return match ? { name: f, timestamp: match[1], path: `${backupDir}/${f}` } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * 恢复指定服务的备份
 * @param {string} service - 服务标识
 * @param {string} timestamp - 备份时间戳
 * @returns {object}
 */
export function restoreBackup(service, timestamp) {
  const adapter = getAdapter(service);
  if (!adapter) {
    return { success: false, error: `Unknown service: "${service}"` };
  }

  const targetPath = adapter.getTargetPath();
  const backupDir = adapter.ensureBackupDir();
  const backupPath = adapter.getBackupPath(timestamp);

  if (!fs.existsSync(backupPath)) {
    return { success: false, error: 'Backup file not found' };
  }

  try {
    // 先备份当前配置
    const currentBackup = createBackup(service);

    fs.copyFileSync(backupPath, targetPath);

    return {
      success: true,
      service,
      restoredFrom: timestamp,
      currentBackup: currentBackup.success ? currentBackup.timestamp : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 恢复指定服务的最新备份
 * @param {string} service - 服务标识
 * @returns {object}
 */
export function restoreLatestBackup(service = 'claude') {
  const backups = listBackups(service);
  if (backups.length === 0) {
    return { success: false, error: 'No backups found' };
  }
  return restoreBackup(service, backups[0].timestamp);
}

/**
 * 转义正则表达式特殊字符
 * @param {string} string
 * @returns {string}
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
