import fs from 'node:fs';
import { getAdapter } from './registry.js';
import { formatTimestamp } from '../utils/date.js';

// 备份文件最大保留数量
const MAX_BACKUPS = 10;

/**
 * 备份指定服务的当前配置
 * @param {string} service - 服务标识，默认为 claude
 * @returns {object} { success: boolean, path?: string, error?: string, timestamp?: string }
 */
export function createBackup(service = 'claude') {
  const adapter = getAdapter(service);
  if (!adapter) {
    return { success: false, error: `Unknown coding tool: "${service}"` };
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

    // 创建备份后清理旧备份
    cleanOldBackups(service);

    return { success: true, path: backupPath, timestamp };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 清理旧备份，保留最新的 MAX_BACKUPS 个
 * @param {string} service - 服务标识
 * @returns {object} { deleted: number, kept: number }
 */
export function cleanOldBackups(service = 'claude') {
  const backups = listBackups(service);

  if (backups.length <= MAX_BACKUPS) {
    return { deleted: 0, kept: backups.length };
  }

  // 需要删除的备份（最旧的）
  const toDelete = backups.slice(MAX_BACKUPS);
  let deletedCount = 0;

  for (const backup of toDelete) {
    try {
      if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
        deletedCount++;
      }
    } catch {
      // 删除失败继续处理下一个
      console.warn(`Failed to delete old backup: ${backup.path}`);
    }
  }

  return { deleted: deletedCount, kept: MAX_BACKUPS };
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
    return { success: false, error: `Unknown coding tool: "${service}"` };
  }

  const targetPath = adapter.getTargetPath();
  adapter.ensureBackupDir();
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
