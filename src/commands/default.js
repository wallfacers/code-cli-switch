import chalk from 'chalk';
import { scanVariants } from '../core/config.js';
import { readState } from '../utils/state.js';
import { switchConfig } from '../core/switcher.js';
import { validateConfigDir, getConfigDir } from '../utils/path.js';
import { selectOption } from '../utils/selector.js';

/**
 * 默认命令 - 无参数时显示交互式选择界面
 */
export async function defaultCommand() {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    console.log(chalk.yellow('\nPlease set CLAUDE_CONFIG_DIR or ensure the default directory exists.'));
    console.log(chalk.gray(`\nDefault locations:`));
    console.log(chalk.gray(`  Windows: %USERPROFILE%\\.claude`));
    console.log(chalk.gray(`  macOS/Linux: ~/.claude`));
    return 1;
  }

  const variants = scanVariants();

  if (variants.length === 0) {
    console.log(chalk.yellow('No configuration variants found.'));
    console.log(chalk.gray(`\nCreate files like settings.json.<variant> in ${getConfigDir()}`));
    console.log(chalk.gray('\nExamples:'));
    console.log(chalk.gray('  settings.json.openai'));
    console.log(chalk.gray('  settings.json.anthropic'));
    console.log(chalk.gray('  settings.json.local'));
    return 0;
  }

  const state = readState();

  // 准备选项
  const options = variants.map(v => ({
    name: v.name,
    active: v.active || state.current === v.name
  }));

  try {
    console.log();
    const selected = await selectOption(options, 'Select configuration to switch:');

    if (options.find(o => o.name === selected)?.active) {
      console.log(chalk.yellow(`\n"${selected}" is already active.`));
    } else {
      const result = switchConfig(selected);
      if (result.success) {
        console.log(chalk.green(`\n✓ Switched to "${selected}"`));
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
    console.log(chalk.gray('  cs-cli list       - List all configurations'));
    console.log(chalk.gray('  cs-cli current    - Show current configuration'));
    console.log(chalk.gray('  cs-cli diff       - Compare configurations'));
    console.log(chalk.gray('  cs-cli ui         - Interactive TUI mode'));
    console.log(chalk.gray('  cs-cli help       - Show all commands'));

    return 0;
  } catch (error) {
    console.log(chalk.gray('\nCancelled.'));
    return 0;
  }
}
