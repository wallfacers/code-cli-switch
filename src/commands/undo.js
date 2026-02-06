import { undoSwitch } from '../core/history.js';
import chalk from 'chalk';

/**
 * 撤销最后一次切换
 * @param {object} options - { service: string }
 */
export function undoCommand(options = {}) {
  const { service = 'claude' } = options;

  const result = undoSwitch(service);

  if (result.success) {
    console.log(chalk.green(`✓ Undid last ${service} switch`));
    if (result.restoredFrom) {
      console.log(chalk.gray(`Restored from: ${result.restoredFrom}`));
    }
  } else {
    console.log(chalk.red(`✗ Failed: ${result.error}`));
  }

  return result;
}
