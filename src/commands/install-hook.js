import chalk from 'chalk';
import { installHook } from '../core/installer.js';

/**
 * install-hook 命令 - 手动安装 hook
 */
export async function installHookCommand() {
  try {
    const result = await installHook();

    if (result.success) {
      console.log(chalk.green('✓ Hook installed:'), result.path);
      return 0;
    } else {
      console.error(chalk.red('✗ Failed to install hook:'), result.error);
      return 1;
    }
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error.message);
    return 1;
  }
}
