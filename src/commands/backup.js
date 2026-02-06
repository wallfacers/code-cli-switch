import chalk from 'chalk';
import { createBackup, listBackups } from '../core/backup.js';
import { getAdapter, listServices } from '../core/registry.js';
import { t } from '../utils/i18n.js';
import { logBackup } from '../utils/logger.js';

/**
 * backup 命令 - 手动备份当前配置
 * @param {object} options - { service: string, list: boolean }
 */
export async function backupCommand(options = {}) {
  const { service = 'claude', list = false } = options;

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(t('switch.unknownService', { name: service })));
    console.log(chalk.yellow(`${t('switch.availableServices')}:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  const result = createBackup(service);

  if (result.success) {
    logBackup(service, result.timestamp);
  }

  if (!result.success) {
    console.error(chalk.red(t('backup.backupFailed', { error: result.error })));
    return 1;
  }

  console.log(chalk.green('✓'), `${adapter.name} ${t('backup.backupCreated')}: ${chalk.cyan(result.timestamp)}`);
  console.log(chalk.gray(`  ${t('backup.path')}: ${result.path}`));

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
    console.log(chalk.yellow(t('backup.noBackupsFound')));
    return 0;
  }

  console.log(chalk.bold(`${t('backup.backupsCount', { count: backups.length })}:\n`));

  for (const backup of backups) {
    const timestamp = backup.timestamp.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3 $4:$5:$6');
    console.log(`  ${chalk.cyan(backup.timestamp)}`);
    console.log(chalk.gray(`    ${timestamp}`));
  }

  return 0;
}
