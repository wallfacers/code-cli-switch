import inquirer from '@inquirer/prompts';
import chalk from 'chalk';
import { listBackups, restoreBackup } from '../core/backup.js';
import { getAdapter, listServices } from '../core/registry.js';

/**
 * 恢复配置备份
 * @param {string} timestamp - 备份时间戳（可选，交互式选择）
 * @param {object} options - { service: string }
 */
export async function restoreCommand(timestamp = null, options = {}) {
  const { service = 'claude' } = options;

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(`Unknown coding tool: "${service}"`));
    console.log(chalk.yellow(`Available coding tools:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  // 如果提供了时间戳，直接恢复
  if (timestamp) {
    return doRestore(service, timestamp);
  }

  // 交互式选择
  const backups = listBackups(service);

  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found'));
    return 0;
  }

  const { selected } = await inquirer.prompt({
    type: 'list',
    name: 'selected',
    message: `Select a ${service} backup to restore:`,
    choices: backups.map(b => ({
      name: formatBackupChoice(b),
      value: b.timestamp
    }))
  });

  return doRestore(service, selected);
}

/**
 * 执行恢复
 * @param {string} service
 * @param {string} timestamp
 */
function doRestore(service, timestamp) {
  const result = restoreBackup(service, timestamp);

  if (!result.success) {
    console.error(chalk.red(`Restore failed: ${result.error}`));
    return 1;
  }

  const adapter = getAdapter(service);
  console.log(chalk.green('✓'), `${adapter.name} backup restored:`, chalk.cyan(timestamp));

  if (result.currentBackup) {
    console.log(chalk.gray(`  Current config backed up as:`), result.currentBackup);
  }

  return 0;
}

/**
 * 格式化备份选项显示
 * @param {{timestamp: string, name: string, path: string}} backup
 * @returns {string}
 */
function formatBackupChoice(backup) {
  const ts = backup.timestamp;
  const date = new Date(
    ts.slice(0, 4),
    parseInt(ts.slice(4, 6)) - 1,
    ts.slice(6, 8),
    ts.slice(8, 10),
    ts.slice(10, 12),
    ts.slice(12, 14)
  );

  const relative = getRelativeTime(date);
  return `${backup.timestamp} (${relative})`;
}

/**
 * 获取相对时间描述
 * @param {Date} date
 * @returns {string}
 */
function getRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
