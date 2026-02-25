import chalk from 'chalk';
import { switchConfig } from '../core/switcher.js';
import { getAdapter, listServices } from '../core/registry.js';
import { t } from '../utils/i18n.js';
import { logSwitch } from '../utils/logger.js';

/**
 * switch 命令 - 切换配置
 * @param {string} variant - 配置变体名称
 * @param {object} options - { service: string, dryRun: boolean, noBackup: boolean }
 */
export async function switchCommand(variant, options = {}) {
  const { service = 'claude', dryRun = false, noBackup = false } = options;

  // 验证服务是否存在
  if (!getAdapter(service)) {
    console.error(chalk.red(t('switch.unknownService', { name: service })));
    console.log(chalk.yellow(`${t('switch.availableServices')}:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  if (!variant) {
    console.error(chalk.red(t('switch.missingVariant')));
    console.log(chalk.gray(t('switch.usage')));
    return 1;
  }

  const result = switchConfig(service, variant, { dryRun, noBackup });

  logSwitch(service, variant, result.success);

  if (!result.success) {
    console.error(chalk.red(`${t('error.prefix')}: ${result.error}`));

    if (result.suggestions && result.suggestions.length > 0) {
      console.log(chalk.yellow(`\n${t('switch.availableVariants')}:`));
      for (const s of result.suggestions) {
        console.log(`  - ${s}`);
      }
    }

    return 1;
  }

  if (result.dryRun) {
    console.log(chalk.yellow(t('switch.dryRun')), result.message);
    console.log(chalk.gray(`  ${t('switch.source')}: ${result.source}`));
    console.log(chalk.gray(`  ${t('switch.target')}: ${result.target}`));
    return 0;
  }

  console.log(chalk.green('✓ '), result.message);

  if (result.backup) {
    console.log(chalk.gray(`  ${t('backup.path')}: ${result.backup}`));
  }

  return 0;
}
