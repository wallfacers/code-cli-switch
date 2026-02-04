import chalk from 'chalk';
import { scanVariants } from '../core/config.js';
import { switchConfig } from '../core/switcher.js';
import { getAdapter, listServices } from '../core/registry.js';
import { selectOption } from '../utils/selector.js';
import { t } from '../utils/i18n.js';

/**
 * 默认命令 - 无参数时显示交互式选择界面
 */
export async function defaultCommand() {
  const services = listServices();

  // 第一步：选择服务
  const serviceOptions = services.map(s => ({
    name: s.id,
    label: `${s.id.padEnd(8)} - ${s.name}`
  }));

  try {
    const selectedService = await selectOption(
      serviceOptions,
      `${t('defaultCmd.selectService')}:`
    );

    const adapter = getAdapter(selectedService);
    if (!adapter) {
      console.log(chalk.red(`\n✗ ${t('defaultCmd.failedToLoadAdapter')} "${selectedService}"`));
      return 1;
    }

    // 第二步：选择该服务的配置
    const variants = scanVariants(selectedService);

    if (variants.length === 0) {
      console.log(chalk.yellow(`\n${t('defaultCmd.noVariantsFound')} ${selectedService}.`));
      console.log(chalk.gray(`\n${t('defaultCmd.createFiles', { basename: adapter.getBaseName(), dir: adapter.getConfigDir() })}`));
      return 0;
    }

    const variantOptions = variants.map(v => ({
      name: v.name,
      active: v.active || v.current
    }));

    const selected = await selectOption(
      variantOptions,
      `${adapter.name} ${t('list.configurations')}:`
    );

    if (variantOptions.find(o => o.name === selected)?.active) {
      console.log(chalk.yellow(`\n"${selected}" ${t('defaultCmd.alreadyActive')} ${selectedService}.`));
    } else {
      const result = switchConfig(selectedService, selected);
      if (result.success) {
        console.log(chalk.green(`\n✓ ${t('defaultCmd.switchedTo')} ${selectedService} "${selected}"`));
        if (result.backup) {
          console.log(chalk.gray(`  ${t('defaultCmd.backup')}: ${result.backup}`));
        }
      } else {
        console.log(chalk.red(`\n✗ ${t('defaultCmd.failed')}: ${result.error}`));
        return 1;
      }
    }

    // 显示命令提示
    console.log(chalk.gray(`\n${t('defaultCmd.commands')}:`));
    console.log(chalk.gray(`  cs-cli list               - ${t('defaultCmd.listAll')}`));
    console.log(chalk.gray(`  cs-cli current            - ${t('defaultCmd.showCurrent')}`));
    console.log(chalk.gray(`  cs-cli switch <variant>   - ${t('defaultCmd.switchConfig')}`));
    console.log(chalk.gray(`  cs-cli switch <v> -s <svc>- ${t('defaultCmd.switchForService')}`));
    console.log(chalk.gray(`  cs-cli ui                 - ${t('defaultCmd.tuiMode')}`));
    console.log(chalk.gray(`  cs-cli help               - ${t('defaultCmd.showAllCommands')}`));

    return 0;
  } catch (error) {
    if (error.message === 'cancelled') {
      console.log(chalk.gray(`\n${t('messages.cancelled')}.`));
    } else {
      console.error(chalk.red(`\n${t('config.switchFailed', { error: error.message })}`));
    }
    return 0;
  }
}
