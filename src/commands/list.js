import chalk from 'chalk';
import { scanVariants, readConfig } from '../core/config.js';
import { readState } from '../utils/state.js';
import { getConfigDir, validateConfigDir } from '../utils/path.js';

/**
 * list 命令 - 列出所有可用配置
 */
export async function listCommand() {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    console.log(chalk.yellow('Please set CLAUDE_CONFIG_DIR or ensure the default directory exists.'));
    return 1;
  }

  const variants = scanVariants();
  const state = readState();

  if (variants.length === 0) {
    console.log(chalk.yellow('No configuration variants found.'));
    console.log(chalk.gray(`Create a file like settings.json.<variant> in ${getConfigDir()}`));
    return 0;
  }

  console.log(chalk.bold('Available configurations:\n'));

  for (const variant of variants) {
    const isActive = variant.active || state.current === variant.name;
    const prefix = isActive ? chalk.green('●') : ' ';
    const suffix = isActive ? chalk.green('(currently active)') : '';

    console.log(`  ${prefix} ${chalk.cyan(variant.name)} ${suffix}`);
  }

  // 显示当前状态
  if (state.current) {
    console.log(`\n${chalk.gray('Current:')} ${chalk.cyan(state.current)}`);
    if (state.last_switch) {
      console.log(`${chalk.gray('Last switched:')} ${new Date(state.last_switch).toLocaleString()}`);
    }
  }

  return 0;
}
