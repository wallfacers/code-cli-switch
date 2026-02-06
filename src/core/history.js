import { listBackups, restoreBackup } from './backup.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 撤销最后一次切换
 * 通过恢复上一个备份来实现
 * @param {string} service - 服务标识
 * @returns {{success: boolean, error?: string, restoredFrom?: string}}
 */
export function undoSwitch(service = 'claude') {
  const backups = listBackups(service);

  if (backups.length < 2) {
    return {
      success: false,
      error: 'No previous backup found. Cannot undo.'
    };
  }

  // 倒数第二个备份是切换前的状态
  const previousBackup = backups[1];

  return restoreBackup(service, previousBackup.timestamp);
}

/**
 * 获取切换历史
 * 基于备份时间戳推断
 * @param {string} service - 服务标识
 * @param {number} limit - 返回条数限制
 * @returns {Array<{timestamp: string, variant: string, isCurrent: boolean}>}
 */
export function getHistory(service = 'claude', limit = 10) {
  const backups = listBackups(service);
  const statePath = getStatePath(service);

  let currentVariant = 'unknown';
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      currentVariant = state.current || 'unknown';
    } catch {
      // 状态文件损坏，使用默认值
    }
  }

  return backups.slice(0, limit).map((backup, index) => ({
    timestamp: backup.timestamp,
    variant: index === 0 ? currentVariant : `backup-${backup.timestamp.slice(-6)}`,
    isCurrent: index === 0
  }));
}

/**
 * 获取状态文件路径
 * @param {string} service - 服务标识
 * @returns {string}
 */
function getStatePath(service) {
  const { getAdapter } = require('./registry.js');
  const adapter = getAdapter(service);
  if (!adapter) {
    return '';
  }
  return path.join(adapter.getConfigDir(), '.cs-state.json');
}
