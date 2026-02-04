import chalk from 'chalk';
import { createBackup, listBackups } from '../core/backup.js';
import { validateConfigDir, getConfigDir } from '../utils/path.js';

/**
 * backup 命令 - 手动备份当前配置
 */
export async function backupCommand(options = {}) {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    return 1;
  }

  const result = createBackup();

  if (!result.success) {
    console.error(chalk.red(`Backup failed: ${result.error}`));
    return 1;
  }

  console.log(chalk.green('✓'), `Backup created: ${chalk.cyan(result.timestamp)}`);
  console.log(chalk.gray(`  Path: ${result.path}`));

  // 显示备份列表
  if (options.list) {
    console.log();
    await listBackupsCommand();
  }

  return 0;
}

/**
 * 列出所有备份
 */
export async function listBackupsCommand() {
  const backups = listBackups();

  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found.'));
    return 0;
  }

  console.log(chalk.bold(`Backups (${backups.length}):\n`));

  for (const backup of backups) {
    const timestamp = backup.timestamp.replace(/T/, ' ').replace(/(\d{2})(\d{2})$/, '$1:$2');
    console.log(`  ${chalk.cyan(backup.timestamp)}`);
    console.log(chalk.gray(`    ${timestamp}`));
  }

  return 0;
}
