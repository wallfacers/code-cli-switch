import chalk from 'chalk';
import { readState } from '../utils/state.js';
import { readConfig } from '../core/config.js';
import { getConfigDir, validateConfigDir } from '../utils/path.js';

/**
 * current 命令 - 显示当前生效配置
 */
export async function currentCommand() {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    return 1;
  }

  const state = readState();

  if (!state.current) {
    console.log(chalk.yellow('No active configuration set.'));
    console.log(chalk.gray('Use "cs-cli switch <variant>" to activate a configuration.'));
    return 0;
  }

  console.log(chalk.bold('Current configuration:'), chalk.cyan(state.current));

  if (state.last_switch) {
    console.log(chalk.gray('Last modified:'), new Date(state.last_switch).toLocaleString());
  }

  if (state.current_hash) {
    console.log(chalk.gray('Content hash:'), state.current_hash);
  }

  // 显示配置内容摘要
  const config = readConfig();
  if (config.success && config.data) {
    console.log();
    console.log(chalk.bold('Configuration summary:'));

    if (config.data.providers) {
      console.log(chalk.gray('  Providers:'), config.data.providers.length);
    }
    if (config.data.model) {
      console.log(chalk.gray('  Model:'), config.data.model);
    }
  }

  // 显示历史
  if (state.history.length > 0) {
    console.log();
    console.log(chalk.bold('Recent history:'));
    const recent = state.history.slice(-3).reverse();
    for (const h of recent) {
      console.log(`  ${chalk.gray('•')} ${chalk.cyan(h.variant)} ${chalk.gray(`(${new Date(h.switched_at).toLocaleDateString()})`)}`);
    }
  }

  return 0;
}
