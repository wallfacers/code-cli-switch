import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { switchConfig } from '../core/switcher.js';
import { getAdapter, listServices } from '../core/registry.js';
import { t } from '../utils/i18n.js';
import { logSwitch } from '../utils/logger.js';

/**
 * Launch Claude process with specified settings file
 * @param {string} settingsPath - Path to settings.json.xxx
 * @returns {Promise<number>} Exit code
 */
async function launchClaude(settingsPath) {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--settings', settingsPath], {
      stdio: 'inherit',
      shell: true
    });

    claude.on('close', (code) => {
      resolve(code || 0);
    });

    claude.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error(chalk.red('Error: claude command not found'));
        console.log(chalk.gray('Please install Claude CLI first'));
      } else {
        console.error(chalk.red(`Error: ${err.message}`));
      }
      resolve(1);
    });
  });
}

/**
 * switch 命令 - 切换配置
 * @param {string} variant - 配置变体名称
 * @param {object} options - { service: string, dryRun: boolean, noBackup: boolean }
 */
export async function switchCommand(variant, options = {}) {
  const { service = 'claude', dryRun = false, noBackup = false } = options;

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(t('switch.unknownService', { name: service })));
    console.log(chalk.yellow(`${t('switch.availableServices')}:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  if (!variant) {
    console.error(chalk.red(t('switch.missingVariant')));
    console.log(chalk.gray(t('switch.usage')));
    return 1;
  }

  // Claude 服务：直接启动进程
  if (service === 'claude') {
    return handleClaudeSwitch(adapter, variant, dryRun);
  }

  // 其他服务：保持原有行为
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

/**
 * 处理 Claude 服务的切换（启动进程）
 * @param {object} adapter - Claude adapter
 * @param {string} variant - 配置变体名称
 * @param {boolean} dryRun - 是否预览模式
 * @returns {Promise<number>} Exit code
 */
async function handleClaudeSwitch(adapter, variant, dryRun) {
  const sourcePath = adapter.getVariantPath(variant);

  // 1. 检查文件是否存在
  if (!sourcePath) {
    console.error(chalk.red(`${t('error.prefix')}: Configuration variant "${variant}" not found`));
    const variants = adapter.scanVariants();
    if (variants.length > 0) {
      console.log(chalk.yellow(`\n${t('switch.availableVariants')}:`));
      for (const v of variants) {
        console.log(`  - ${v.name}`);
      }
    }
    return 1;
  }

  // 2. 验证格式
  const validation = adapter.validate(sourcePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';
    console.error(chalk.red(`${t('error.prefix')}: Invalid format in ${adapter.getBaseName()}.${variant}: ${errorMsg}`));
    return 1;
  }

  // 3. 预览模式
  if (dryRun) {
    console.log(chalk.yellow(t('switch.dryRun')), `Would launch claude with: ${sourcePath}`);
    return 0;
  }

  // 4. 启动 Claude
  console.log(chalk.green('✓ '), `Launching Claude with ${variant} configuration...`);
  return launchClaude(sourcePath);
}
