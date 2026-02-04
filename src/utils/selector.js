import readline from 'node:readline';
import chalk from 'chalk';
import { t } from './i18n.js';

/**
 * 简单的终端交互式选择器
 * @param {Array<{name: string, active?: boolean}>} options
 * @param {string} title - 标题
 * @param {object} config - 配置选项
 * @returns {Promise<string>} 选中的选项名称
 */
export function selectOption(options, title = null, config = {}) {
  const {
    activeSuffix = t('ui.activeSuffix'),
    helpText = t('ui.useKeysHelp'),
    defaultTitle = t('ui.selectOption')
  } = config;

  const displayTitle = title || defaultTitle;

  return new Promise((resolve, reject) => {
    if (options.length === 0) {
      reject(new Error('No options available'));
      return;
    }

    let selectedIndex = options.findIndex(o => o.active) ?? 0;
    let lastKeyPressTime = 0;
    const THROTTLE_DELAY = 50;

    // 隐藏光标
    process.stdout.write('\x1B[?25l');

    // 保存当前光标位置
    process.stdout.write('\x1B[s');

    /**
     * 渲染整个菜单
     */
    function render() {
      // 恢复到保存的光标位置
      process.stdout.write('\x1B[u');

      // 清除从光标位置到屏幕末尾
      process.stdout.write('\x1B[J');

      // 渲染标题
      console.log(chalk.bold(displayTitle));
      console.log();

      // 渲染选项
      options.forEach((option, index) => {
        const prefix = index === selectedIndex ? chalk.cyan('▸ ') : '  ';
        const suffix = option.active ? chalk.green(activeSuffix) : '';
        const name = index === selectedIndex ? chalk.cyan.bold(option.name) : option.name;

        console.log(prefix + name + suffix);
      });

      console.log();
      console.log(chalk.gray(helpText));
    }

    // 设置原始模式
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    render();

    function onKey(data) {
      const key = data.toString();

      if (key === '\u0003' || key === 'q' || key === '\u001B') {
        // Ctrl+C or q or ESC
        cleanup();
        reject(new Error('cancelled'));
        return;
      }

      if (key === '\r' || key === '\n') {
        // Enter
        cleanup();
        resolve(options[selectedIndex].name);
        return;
      }

      const now = Date.now();

      if (key === '\u001B[A' || key === 'k') {
        // Up arrow or k
        if (now - lastKeyPressTime < THROTTLE_DELAY) return;
        lastKeyPressTime = now;
        if (selectedIndex > 0) {
          selectedIndex--;
          render();
        }
        return;
      }

      if (key === '\u001B[B' || key === 'j') {
        // Down arrow or j
        if (now - lastKeyPressTime < THROTTLE_DELAY) return;
        lastKeyPressTime = now;
        if (selectedIndex < options.length - 1) {
          selectedIndex++;
          render();
        }
        return;
      }
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onKey);

      // 恢复光标位置并清除菜单
      process.stdout.write('\x1B[u');
      process.stdout.write('\x1B[J');
      process.stdout.write('\x1B[?25h'); // 显示光标
    }

    process.stdin.on('data', onKey);
  });
}
