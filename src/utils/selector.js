import readline from 'node:readline';
import chalk from 'chalk';

/**
 * 简单的终端交互式选择器
 * @param {Array<{name: string, active?: boolean}>} options
 * @param {string} message
 * @returns {Promise<string>} 选中的选项名称
 */
export function selectOption(options, message = 'Select an option:') {
  return new Promise((resolve, reject) => {
    if (options.length === 0) {
      reject(new Error('No options available'));
      return;
    }

    let selectedIndex = options.findIndex(o => o.active) ?? 0;
    let lastKeyPressTime = 0;
    let lastSelectedIndex = selectedIndex; // 记录上一次的选择
    const THROTTLE_DELAY = 50; // 50ms 节流延迟

    // 隐藏光标
    process.stdout.write('\x1B[?25l');

    const lines = options.length + 3; // 消息 + 提示 + 选项

    function render() {
      if (selectedIndex === lastSelectedIndex) return;

      // 更新旧选中的行（恢复为普通状态）
      updateOptionLine(lastSelectedIndex, false);

      // 更新新选中的行（高亮显示）
      updateOptionLine(selectedIndex, true);

      lastSelectedIndex = selectedIndex;
    }

    /**
     * 使用 ANSI 转义序列更新单个选项行
     * @param {number} index - 选项索引
     * @param {boolean} isSelected - 是否被选中
     */
    function updateOptionLine(index, isSelected) {
      const lineOffset = index + 3; // 消息(1) + 提示(1) + 空行(1) = 3行偏移
      const option = options[index];

      // 移动光标到目标行
      process.stdout.write(`\x1B[${lineOffset};0H`);

      // 清除该行（从当前位置到行尾）
      process.stdout.write('\x1B[K');

      // 重新绘制该行
      const prefix = isSelected ? chalk.cyan('▸ ') : '  ';
      const suffix = option.active ? chalk.green(' (active)') : '';
      const name = isSelected ? chalk.cyan.bold(option.name) : option.name;

      process.stdout.write(prefix + name + suffix);
    }

    /**
     * 初次渲染整个界面
     */
    function initialRender() {
      // 移动光标到起始位置并清除
      readline.moveCursor(process.stdout, 0, -lines);
      readline.clearScreenDown(process.stdout);

      // 渲染标题
      process.stdout.write(chalk.cyan.bold(message) + '\n');
      process.stdout.write(chalk.gray('Use ↑/↓ to select, Enter to confirm, q to quit') + '\n');

      // 渲染选项
      options.forEach((option, index) => {
        const prefix = index === selectedIndex ? chalk.cyan('▸ ') : '  ';
        const suffix = option.active ? chalk.green(' (active)') : '';
        const name = index === selectedIndex ? chalk.cyan.bold(option.name) : option.name;

        process.stdout.write(prefix + name + suffix + '\n');
      });
    }

    // 设置原始模式
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    initialRender();

    function onKey(data) {
      const key = data.toString();

      if (key === '\u0003' || key === 'q' || key === '\u001B') {
        // Ctrl+C or q or ESC
        cleanup();
        process.exit(0);
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
        // Up arrow or k - 应用节流
        if (now - lastKeyPressTime < THROTTLE_DELAY) {
          return; // 节流：忽略过快的按键
        }
        lastKeyPressTime = now;
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
        return;
      }

      if (key === '\u001B[B' || key === 'j') {
        // Down arrow or j - 应用节流
        if (now - lastKeyPressTime < THROTTLE_DELAY) {
          return; // 节流：忽略过快的按键
        }
        lastKeyPressTime = now;
        selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
        render();
        return;
      }
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onKey);

      // 清除菜单内容 - 使用绝对位置移动到顶部并清除
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);

      process.stdout.write('\x1B[?25h'); // 显示光标
    }

    process.stdin.on('data', onKey);
  });
}
