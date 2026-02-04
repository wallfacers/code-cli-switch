import chalk from 'chalk';
import { validateConfigDir, getConfigDir } from '../utils/path.js';
import { scanVariants } from '../core/config.js';
import { switchConfig } from '../core/switcher.js';
import { createBackup } from '../core/backup.js';
import { readState } from '../utils/state.js';
import readline from 'readline';

/**
 * 交互式菜单 - 使用简单的 readline 界面
 */
export async function interactiveCommand() {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    return 1;
  }

  const state = readState();
  let variants = scanVariants();
  let selectedIndex = 0;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function displayMenu() {
    console.clear();
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('           Claude Settings Switcher               '));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log();
    console.log(chalk.bold('Available Configurations:'));
    console.log();

    variants.forEach((variant, index) => {
      const isSelected = index === selectedIndex;
      const isActive = variant.active || state?.current === variant.name;

      if (isSelected) {
        console.log(chalk.cyan('▸') + ' ' + chalk.bold[isActive ? 'green' : 'white'](variant.name) + (isActive ? chalk.gray(' (active)') : ''));
      } else {
        console.log('  ' + (isActive ? chalk.green(variant.name) + chalk.gray(' (active)') : variant.name));
      }
    });

    console.log();
    console.log(chalk.gray('─').repeat(53));
    console.log(chalk.bold('Commands:'));
    console.log('  ' + chalk.cyan('↑/k') + '     Move up');
    console.log('  ' + chalk.cyan('↓/j') + '     Move down');
    console.log('  ' + chalk.cyan('Enter') + '  Switch to selected');
    console.log('  ' + chalk.cyan('b') + '       Create backup');
    console.log('  ' + chalk.cyan('r') + '       Refresh list');
    console.log('  ' + chalk.cyan('q') + '       Quit');
    console.log();
  }

  return new Promise((resolve) => {
    // Windows 上使用更简单的输入处理
    if (process.platform === 'win32') {
      displayMenu();

      rl.question(chalk.gray('Select configuration (name or number, or q to quit): '), (answer) => {
        rl.close();

        if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'quit') {
          console.log(chalk.gray('Cancelled.'));
          return resolve(0);
        }

        // 尝试按数字选择
        const num = parseInt(answer);
        if (!isNaN(num) && num >= 1 && num <= variants.length) {
          const variant = variants[num - 1];
          if (!variant.active) {
            const result = switchConfig(variant.name);
            if (result.success) {
              console.log(chalk.green(`✓ Switched to ${variant.name}`));
            } else {
              console.error(chalk.red(`✗ Failed: ${result.error}`));
              return resolve(1);
            }
          } else {
            console.log(chalk.yellow(`Already using ${variant.name}`));
          }
          return resolve(0);
        }

        // 尝试按名称选择
        const variant = variants.find(v => v.name.toLowerCase() === answer.toLowerCase());
        if (variant) {
          if (!variant.active) {
            const result = switchConfig(variant.name);
            if (result.success) {
              console.log(chalk.green(`✓ Switched to ${variant.name}`));
            } else {
              console.error(chalk.red(`✗ Failed: ${result.error}`));
              return resolve(1);
            }
          } else {
            console.log(chalk.yellow(`Already using ${variant.name}`));
          }
          return resolve(0);
        }

        console.error(chalk.red(`Configuration "${answer}" not found`));
        return resolve(1);
      });
    } else {
      // Unix 系统使用原始模式
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const handleInput = (key) => {
        if (key === 'q' || key === '\u0003') { // q or Ctrl+C
          cleanup();
          console.log(chalk.gray('\nCancelled.'));
          return resolve(0);
        }

        if (key === 'r') {
          variants = scanVariants();
          displayMenu();
          return;
        }

        if (key === 'b') {
          const result = createBackup();
          console.log(chalk[result.success ? 'green' : 'red'](`\n${result.success ? '✓' : '✗'} Backup ${result.success ? 'created: ' + result.timestamp : 'failed: ' + result.error}`));
          setTimeout(() => displayMenu(), 1000);
          return;
        }

        if (key === '\u001b[A' || key === 'k') { // Up arrow or k
          selectedIndex = Math.max(0, selectedIndex - 1);
          displayMenu();
          return;
        }

        if (key === '\u001b[B' || key === 'j') { // Down arrow or j
          selectedIndex = Math.min(variants.length - 1, selectedIndex + 1);
          displayMenu();
          return;
        }

        if (key === '\r' || key === '\n') { // Enter
          const variant = variants[selectedIndex];
          if (variant && !variant.active) {
            cleanup();
            const result = switchConfig(variant.name);
            if (result.success) {
              console.log(chalk.green(`\n✓ Switched to ${variant.name}`));
            } else {
              console.error(chalk.red(`\n✗ Failed: ${result.error}`));
              return resolve(1);
            }
            return resolve(0);
          } else if (variant?.active) {
            console.log(chalk.yellow(`\nAlready using ${variant.name}`));
            cleanup();
            return resolve(0);
          }
        }
      };

      const cleanup = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handleInput);
        rl.close();
      };

      process.stdin.on('data', handleInput);
      displayMenu();
    }
  });
}
