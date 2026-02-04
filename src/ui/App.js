import readline from 'node:readline';
import chalk from 'chalk';
import { scanVariants } from '../core/config.js';
import { readState } from '../utils/state.js';
import { switchConfig } from '../core/switcher.js';
import { createBackup } from '../core/backup.js';

/**
 * 简单的 TUI 实现，不使用 Ink 框架
 * 使用全局刷新方式避免渲染问题
 */
export async function runTUI() {
  let variants = scanVariants();
  let state = readState();
  let selectedIndex = 0;
  let showDiff = false;
  let message = '';
  let messageTimeout = null;

  // 初始化选中项（优先选中当前激活的配置）
  const activeIndex = variants.findIndex(v => v.active || state?.current === v.name);
  if (activeIndex >= 0) {
    selectedIndex = activeIndex;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  /**
   * 渲染整个界面
   */
  function render() {
    // 清屏并移动光标到顶部
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);

    // 标题
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('           Claude Settings Switcher               '));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log();

    // 消息提示
    if (message) {
      console.log(chalk.yellow(`  ${message}`));
      console.log();
    }

    // 配置列表
    console.log(chalk.bold('Available Configurations:'));
    console.log();

    variants.forEach((variant, index) => {
      const isSelected = index === selectedIndex;
      const isActive = variant.active || state?.current === variant.name;

      if (isSelected) {
        console.log(
          chalk.cyan('▸') + ' ' +
          chalk.bold(isActive ? 'green' : 'white')(variant.name) +
          (isActive ? chalk.gray(' (active)') : '')
        );
      } else {
        console.log(
          '  ' +
          (isActive ? chalk.green(variant.name) + chalk.gray(' (active)') : variant.name)
        );
      }
    });

    console.log();
    console.log(chalk.gray('─').repeat(53));
    console.log(chalk.bold('Commands:'));
    console.log('  ' + chalk.cyan('↑/k') + '     Move up');
    console.log('  ' + chalk.cyan('↓/j') + '     Move down');
    console.log('  ' + chalk.cyan('Enter') + '  Switch to selected');
    console.log('  ' + chalk.cyan('d') + '       Toggle diff view');
    console.log('  ' + chalk.cyan('r') + '       Refresh list');
    console.log('  ' + chalk.cyan('b') + '       Create backup');
    console.log('  ' + chalk.cyan('q') + '       Quit');
    console.log();

    if (showDiff) {
      const selectedVariant = variants[selectedIndex];
      if (selectedVariant) {
        console.log(chalk.gray('─').repeat(53));
        console.log(chalk.cyan.bold(`Diff for: ${selectedVariant.name}`));
        console.log(chalk.gray('─').repeat(53));
        // 这里可以添加 diff 显示逻辑
        console.log(chalk.gray('Diff view coming soon...'));
        console.log();
      }
    }
  }

  /**
   * 显示临时消息
   */
  function showMessage(msg, duration = 2000) {
    message = msg;
    render();

    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }

    messageTimeout = setTimeout(() => {
      message = '';
      render();
    }, duration);
  }

  /**
   * 刷新数据
   */
  function refresh() {
    variants = scanVariants();
    state = readState();

    // 确保 selectedIndex 在有效范围内
    if (selectedIndex >= variants.length) {
      selectedIndex = Math.max(0, variants.length - 1);
    }

    render();
  }

  // Windows 平台使用简单输入模式
  if (process.platform === 'win32') {
    render();

    rl.question(chalk.gray('Select configuration (name or number, or q to quit): '), (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'quit') {
        console.log(chalk.gray('Cancelled.'));
        return;
      }

      // 按数字选择
      const num = parseInt(answer);
      if (!isNaN(num) && num >= 1 && num <= variants.length) {
        const variant = variants[num - 1];
        const isActive = variant.active || state?.current === variant.name;

        if (!isActive) {
          const result = switchConfig(variant.name);
          if (result.success) {
            console.log(chalk.green(`✓ Switched to ${variant.name}`));
          } else {
            console.error(chalk.red(`✗ Failed: ${result.error}`));
          }
        } else {
          console.log(chalk.yellow(`Already using ${variant.name}`));
        }
        return;
      }

      // 按名称选择
      const variant = variants.find(v => v.name.toLowerCase() === answer.toLowerCase());
      if (variant) {
        const isActive = variant.active || state?.current === variant.name;

        if (!isActive) {
          const result = switchConfig(variant.name);
          if (result.success) {
            console.log(chalk.green(`✓ Switched to ${variant.name}`));
          } else {
            console.error(chalk.red(`✗ Failed: ${result.error}`));
          }
        } else {
          console.log(chalk.yellow(`Already using ${variant.name}`));
        }
        return;
      }

      console.error(chalk.red(`Configuration "${answer}" not found`));
    });

    return;
  }

  // Unix 系统使用原始模式
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  render();

  const handleInput = (key) => {
    if (key === 'q' || key === '\u0003') { // q or Ctrl+C
      cleanup();
      console.log(chalk.gray('\nCancelled.'));
      process.exit(0);
      return;
    }

    if (key === 'r') {
      refresh();
      showMessage('Refreshed', 1000);
      return;
    }

    if (key === 'b') {
      const result = createBackup();
      if (result.success) {
        showMessage(`Backup created: ${result.timestamp}`);
      } else {
        showMessage(`Backup failed: ${result.error}`);
      }
      return;
    }

    if (key === 'd') {
      showDiff = !showDiff;
      render();
      return;
    }

    if (key === '\u001b[A' || key === 'k') { // Up arrow or k
      selectedIndex = Math.max(0, selectedIndex - 1);
      render();
      return;
    }

    if (key === '\u001b[B' || key === 'j') { // Down arrow or j
      selectedIndex = Math.min(variants.length - 1, selectedIndex + 1);
      render();
      return;
    }

    if (key === '\r' || key === '\n') { // Enter
      const variant = variants[selectedIndex];
      if (!variant) return;

      const isActive = variant.active || state?.current === variant.name;

      if (!isActive) {
        const result = switchConfig(variant.name);
        if (result.success) {
          showMessage(`Switched to ${variant.name}`);
          refresh();
        } else {
          showMessage(`Failed: ${result.error}`);
        }
      } else {
        showMessage(`Already using ${variant.name}`, 1500);
      }
      return;
    }
  };

  const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeListener('data', handleInput);
    rl.close();
  };

  process.stdin.on('data', handleInput);
}
