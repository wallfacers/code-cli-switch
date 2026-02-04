import chalk from 'chalk';
import { scanVariants } from '../core/config.js';
import { switchConfig } from '../core/switcher.js';
import { getAdapter, listServices } from '../core/registry.js';
import { selectOption } from '../utils/selector.js';

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
      'Select service:'
    );

    const adapter = getAdapter(selectedService);
    if (!adapter) {
      console.log(chalk.red(`\n✗ Failed to load adapter for "${selectedService}"`));
      return 1;
    }

    // 第二步：选择该服务的配置
    const variants = scanVariants(selectedService);

    if (variants.length === 0) {
      console.log(chalk.yellow(`\nNo configuration variants found for ${selectedService}.`));
      console.log(chalk.gray(`\nCreate files like ${adapter.getBaseName()}.<variant> in ${adapter.getConfigDir()}`));
      return 0;
    }

    const variantOptions = variants.map(v => ({
      name: v.name,
      active: v.active || v.current
    }));

    const selected = await selectOption(
      variantOptions,
      `${adapter.name} configurations:`
    );

    if (variantOptions.find(o => o.name === selected)?.active) {
      console.log(chalk.yellow(`\n"${selected}" is already active for ${selectedService}.`));
    } else {
      const result = switchConfig(selectedService, selected);
      if (result.success) {
        console.log(chalk.green(`\n✓ Switched ${selectedService} to "${selected}"`));
        if (result.backup) {
          console.log(chalk.gray(`  Backup: ${result.backup}`));
        }
      } else {
        console.log(chalk.red(`\n✗ Failed: ${result.error}`));
        return 1;
      }
    }

    // 显示命令提示
    console.log(chalk.gray('\nCommands:'));
    console.log(chalk.gray('  cs-cli list               - List all configurations'));
    console.log(chalk.gray('  cs-cli current            - Show current configuration'));
    console.log(chalk.gray('  cs-cli switch <variant>   - Switch configuration'));
    console.log(chalk.gray('  cs-cli switch <v> -s <svc>- Switch for specific service'));
    console.log(chalk.gray('  cs-cli ui                 - Interactive TUI mode'));
    console.log(chalk.gray('  cs-cli help               - Show all commands'));

    return 0;
  } catch (error) {
    if (error.message === 'cancelled') {
      console.log(chalk.gray('\nCancelled.'));
    } else {
      console.error(chalk.red(`\nError: ${error.message}`));
    }
    return 0;
  }
}
