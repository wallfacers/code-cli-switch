import chalk from 'chalk';
import { switchConfig } from '../core/switcher.js';
import { getAdapter, listServices } from '../core/registry.js';

/**
 * switch 命令 - 切换配置
 * @param {string} variant - 配置变体名称
 * @param {object} options - { service: string, dryRun: boolean, noBackup: boolean }
 */
export async function switchCommand(variant, options = {}) {
  const { service = 'claude', dryRun = false, noBackup = false } = options;

  // 验证服务是否存在
  if (!getAdapter(service)) {
    console.error(chalk.red(`Error: Unknown service "${service}"`));
    console.log(chalk.yellow('Available services:'), listServices().map(s => s.id).join(', '));
    return 1;
  }

  if (!variant) {
    console.error(chalk.red('Error: Missing required argument <variant>'));
    console.log(chalk.gray(`Usage: cs-cli switch <variant> [--service <name>]`));
    return 1;
  }

  const result = switchConfig(service, variant, { dryRun, noBackup });

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));

    if (result.suggestions && result.suggestions.length > 0) {
      console.log(chalk.yellow('\nAvailable variants:'));
      for (const s of result.suggestions) {
        console.log(`  - ${s}`);
      }
    }

    return 1;
  }

  if (result.dryRun) {
    console.log(chalk.yellow('[Dry run]'), result.message);
    console.log(chalk.gray(`  Source: ${result.source}`));
    console.log(chalk.gray(`  Target: ${result.target}`));
    return 0;
  }

  console.log(chalk.green('✓'), result.message);

  if (result.backup) {
    console.log(chalk.gray(`  Backup saved: ${result.backup}`));
  }

  return 0;
}
