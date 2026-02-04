import chalk from 'chalk';
import { switchConfig } from '../core/switcher.js';
import { validateConfigDir, getConfigDir } from '../utils/path.js';

/**
 * switch 命令 - 切换配置
 */
export async function switchCommand(variant, options = {}) {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    return 1;
  }

  if (!variant) {
    console.error(chalk.red('Error: Missing required argument <variant>'));
    console.log(chalk.gray('Usage: cs-cli switch <variant>'));
    return 1;
  }

  const result = switchConfig(variant, options);

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
