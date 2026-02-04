import chalk from 'chalk';
import { createBackup, listBackups } from '../core/backup.js';
import { getAdapter, listServices } from '../core/registry.js';

/**
 * backup 命令 - 手动备份当前配置
 * @param {object} options - { service: string, list: boolean }
 */
export async function backupCommand(options = {}) {
  const { service = 'claude', list = false } = options;

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(`Error: Unknown service "${service}"`));
    console.log(chalk.yellow('Available services:'), listServices().map(s => s.id).join(', '));
    return 1;
  }

  const result = createBackup(service);

  if (!result.success) {
    console.error(chalk.red(`Backup failed: ${result.error}`));
    return 1;
  }

  console.log(chalk.green('✓'), `${adapter.name} backup created: ${chalk.cyan(result.timestamp)}`);
  console.log(chalk.gray(`  Path: ${result.path}`));

  // 显示备份列表
  if (list) {
    console.log();
    await listBackupsCommand(service);
  }

  return 0;
}

/**
 * 列出所有备份
 * @param {string} service - 服务标识
 */
export async function listBackupsCommand(service = 'claude') {
  const backups = listBackups(service);

  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found.'));
    return 0;
  }

  console.log(chalk.bold(`Backups (${backups.length}):\n`));

  for (const backup of backups) {
    const timestamp = backup.timestamp.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3 $4:$5:$6');
    console.log(`  ${chalk.cyan(backup.timestamp)}`);
    console.log(chalk.gray(`    ${timestamp}`));
  }

  return 0;
}
