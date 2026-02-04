import readline from 'node:readline';
import chalk from 'chalk';
import { scanVariants, getCurrentStatus } from '../core/config.js';
import { switchConfig } from '../core/switcher.js';
import { createBackup } from '../core/backup.js';
import { getAdapter, listServices } from '../core/registry.js';

/**
 * 两级选择 TUI：先选服务，再选配置
 */
export async function runTUI() {
  const services = listServices();

  // 第一级：选择服务
  const selectedService = await selectService(services);
  if (!selectedService) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  // 第二级：选择配置
  await selectConfig(selectedService);
}

/**
 * 选择服务
 * @param {Array} services
 * @returns {Promise<string|null>} 服务 ID
 */
async function selectService(services) {
  let selectedIndex = 0;

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const options = services.map(s => ({
      name: s.id,
      label: `${s.id.padEnd(8)} - ${s.name}`
    }));

    function render() {
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);

      console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
      console.log(chalk.cyan.bold('           Configuration Switcher                  '));
      console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
      console.log();
      console.log(chalk.bold('Select service:\n'));

      options.forEach((opt, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? chalk.cyan('▸') : ' ';
        const text = isSelected ? chalk.cyan.bold(opt.label) : opt.label;
        console.log(`  ${prefix} ${text}`);
      });

      console.log();
      console.log(chalk.gray('─').repeat(53));
      console.log(chalk.gray('Use ↑/↓ to select, Enter to confirm, q to quit'));
      console.log();
    }

    // Windows 平台使用简单输入
    if (process.platform === 'win32') {
      render();
      rl.question(chalk.gray('Select service (name or number, or q to quit): '), (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'q') {
          resolve(null);
          return;
        }

        // 按数字选择
        const num = parseInt(answer);
        if (!isNaN(num) && num >= 1 && num <= options.length) {
          resolve(options[num - 1].name);
          return;
        }

        // 按名称选择
        const selected = options.find(o => o.name.toLowerCase() === answer.toLowerCase());
        if (selected) {
          resolve(selected.name);
        } else {
          console.error(chalk.red(`Service "${answer}" not found`));
          resolve(null);
        }
      });
      return;
    }

    // Unix 系统使用原始模式
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    render();

    const handleInput = (key) => {
      if (key === 'q' || key === '\u0003' || key === '\u001B') {
        cleanup();
        resolve(null);
        return;
      }

      if (key === '\u001B[A' || key === 'k') {
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
        return;
      }

      if (key === '\u001B[B' || key === 'j') {
        selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
        render();
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup();
        resolve(options[selectedIndex].name);
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
  });
}

/**
 * 选择配置变体
 * @param {string} serviceId
 */
async function selectConfig(serviceId) {
  const adapter = getAdapter(serviceId);
  if (!adapter) {
    console.error(chalk.red(`Failed to load adapter for "${serviceId}"`));
    return;
  }

  let variants = scanVariants(serviceId);
  let status = getCurrentStatus(serviceId);
  let selectedIndex = 0;
  let showDiff = false;
  let message = '';
  let messageTimeout = null;

  // 选中当前激活的配置
  const activeIndex = variants.findIndex(v => v.active || status?.current === v.name);
  if (activeIndex >= 0) {
    selectedIndex = activeIndex;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function render() {
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);

    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold(`           ${adapter.name} Configurations               `));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
    console.log();

    if (message) {
      console.log(chalk.yellow(`  ${message}`));
      console.log();
    }

    console.log(chalk.bold(`Select configuration (Esc to back):\n`));

    variants.forEach((variant, index) => {
      const isSelected = index === selectedIndex;
      const isActive = variant.active || status?.current === variant.name;

      if (isSelected) {
        console.log(
          chalk.cyan('▸') + ' ' +
          chalk.bold(variant.name) +
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
    console.log('  ' + chalk.cyan('Esc') + '     Back to service selection');
    console.log('  ' + chalk.cyan('q') + '       Quit');
    console.log();

    if (showDiff) {
      const selectedVariant = variants[selectedIndex];
      if (selectedVariant) {
        console.log(chalk.gray('─').repeat(53));
        console.log(chalk.cyan.bold(`Diff for: ${selectedVariant.name}`));
        console.log(chalk.gray('─').repeat(53));
        console.log(chalk.gray('Diff view coming soon...'));
        console.log();
      }
    }
  }

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

  function refresh() {
    variants = scanVariants(serviceId);
    status = getCurrentStatus(serviceId);

    if (selectedIndex >= variants.length) {
      selectedIndex = Math.max(0, variants.length - 1);
    }

    render();
  }

  // Windows 平台
  if (process.platform === 'win32') {
    render();

    rl.question(chalk.gray('Select configuration (name or number, Esc to back, q to quit): '), (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'q') {
        console.log(chalk.gray('Cancelled.'));
        return;
      }
      if (answer === '\u001B' || answer.toLowerCase() === 'b' || answer.toLowerCase() === 'back') {
        runTUI(); // 返回服务选择
        return;
      }

      const num = parseInt(answer);
      if (!isNaN(num) && num >= 1 && num <= variants.length) {
        const variant = variants[num - 1];
        doSwitch(variant);
        return;
      }

      const variant = variants.find(v => v.name.toLowerCase() === answer.toLowerCase());
      if (variant) {
        doSwitch(variant);
      } else {
        console.error(chalk.red(`Configuration "${answer}" not found`));
      }
    });

    return;
  }

  // Unix 系统
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  render();

  const handleInput = (key) => {
    if (key === 'q' || key === '\u0003') {
      cleanup();
      console.log(chalk.gray('\nCancelled.'));
      process.exit(0);
      return;
    }

    if (key === '\u001B') { // Esc
      cleanup();
      runTUI(); // 返回服务选择
      return;
    }

    if (key === 'r') {
      refresh();
      showMessage('Refreshed', 1000);
      return;
    }

    if (key === 'b') {
      const result = createBackup(serviceId);
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

    if (key === '\u001B[A' || key === 'k') {
      selectedIndex = Math.max(0, selectedIndex - 1);
      render();
      return;
    }

    if (key === '\u001B[B' || key === 'j') {
      selectedIndex = Math.min(variants.length - 1, selectedIndex + 1);
      render();
      return;
    }

    if (key === '\r' || key === '\n') {
      const variant = variants[selectedIndex];
      if (!variant) return;

      const isActive = variant.active || status?.current === variant.name;

      if (!isActive) {
        const result = switchConfig(serviceId, variant.name);
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

  function doSwitch(variant) {
    const isActive = variant.active || status?.current === variant.name;

    if (!isActive) {
      const result = switchConfig(serviceId, variant.name);
      if (result.success) {
        console.log(chalk.green(`✓ Switched ${serviceId} to ${variant.name}`));
      } else {
        console.error(chalk.red(`✗ Failed: ${result.error}`));
      }
    } else {
      console.log(chalk.yellow(`Already using ${variant.name}`));
    }
  }

  const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeListener('data', handleInput);
    rl.close();
  };

  process.stdin.on('data', handleInput);
}
