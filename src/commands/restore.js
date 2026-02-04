import chalk from 'chalk';
import { restoreLatestBackup, listBackups } from '../core/backup.js';
import { getAdapter, listServices } from '../core/registry.js';

/**
 * restore 命令 - 恢复备份
 * @param {string} timestamp - 备份时间戳（可选）
 * @param {object} options - { service: string }
 */
export async function restoreCommand(timestamp = null, options = {}) {
  const { service = 'claude' } = options;

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(`Error: Unknown service "${service}"`));
    console.log(chalk.yellow('Available services:'), listServices().map(s => s.id).join(', '));
    return 1;
  }

  // 如果没有指定时间戳，显示可用备份
  if (!timestamp) {
    const backups = listBackups(service);
    if (backups.length === 0) {
      console.log(chalk.yellow(`No backups found for ${service}.`));
      return 0;
    }

    // 如果只有一个备份，直接恢复
    if (backups.length === 1) {
      console.log(chalk.yellow(`Restoring latest backup for ${service}: ${backups[0].timestamp}`));
      return doRestore(service, backups[0].timestamp);
    }

    // 多个备份，让用户选择
    console.log(chalk.yellow(`Available backups for ${service}:`));
    for (const b of backups) {
      const timestampFormatted = b.timestamp.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3 $4:$5:$6');
      console.log(`  ${chalk.cyan(b.timestamp)} ${chalk.gray(`(${timestampFormatted})`)}`);
    }
    console.log(chalk.gray(`\nUse "cs-cli restore <timestamp> --service ${service}" to restore a specific backup.`));
    return 0;
  }

  return doRestore(service, timestamp);
}

/**
 * 执行恢复
 * @param {string} service
 * @param {string} timestamp
 */
async function doRestore(service, timestamp) {
  const { restoreBackup } = await import('../core/backup.js');
  const adapter = getAdapter(service);

  const result = restoreBackup(service, timestamp);

  if (!result.success) {
    console.error(chalk.red(`Restore failed: ${result.error}`));
    return 1;
  }

  console.log(chalk.green('✓'), `${adapter.name} backup restored: ${chalk.cyan(timestamp)}`);

  if (result.currentBackup) {
    console.log(chalk.gray(`  Current config backed up as: ${result.currentBackup}`));
  }

  return 0;
}
