import chalk from 'chalk';
import { restoreBackup, restoreLatestBackup, listBackups } from '../core/backup.js';
import { validateConfigDir, getConfigDir } from '../utils/path.js';

/**
 * restore 命令 - 恢复备份
 */
export async function restoreCommand(timestamp = null) {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    return 1;
  }

  // 如果没有指定时间戳，恢复最新的
  if (!timestamp) {
    const backups = listBackups();
    if (backups.length === 0) {
      console.log(chalk.yellow('No backups found.'));
      return 0;
    }

    // 如果只有一个备份，直接恢复
    if (backups.length === 1) {
      console.log(chalk.yellow(`Restoring latest backup: ${backups[0].timestamp}`));
      timestamp = backups[0].timestamp;
    } else {
      console.log(chalk.yellow('Available backups:'));
      for (const b of backups) {
        console.log(`  ${chalk.cyan(b.timestamp)}`);
      }
      console.log(chalk.gray('\nUse "cs-cli restore <timestamp>" to restore a specific backup.'));
      return 0;
    }
  }

  const result = restoreBackup(timestamp);

  if (!result.success) {
    console.error(chalk.red(`Restore failed: ${result.error}`));
    return 1;
  }

  console.log(chalk.green('✓'), `Restored backup: ${chalk.cyan(timestamp)}`);

  if (result.currentBackup) {
    console.log(chalk.gray(`  Current config backed up as: ${result.currentBackup}`));
  }

  return 0;
}
