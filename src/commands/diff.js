import chalk from 'chalk';
import { readConfig } from '../core/config.js';
import { getAdapter, listServices } from '../core/registry.js';
import { diffLines } from 'diff';
import { t, initI18n } from '../utils/i18n.js';

// 初始化国际化
initI18n();

/**
 * 比较两个配置
 * @param {string} variant1 - 第一个配置变体名称（或 'current'）
 * @param {string} variant2 - 第二个配置变体名称（可选）
 * @param {object} options - { service: string }
 */
export async function diffCommand(variant1, variant2 = null, options = {}) {
  const { service = 'claude' } = options;

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(`${t('error.prefix')}: ${t('switch.unknownService', { name: service })}`));
    console.log(chalk.yellow(`${t('switch.availableServices')}:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  // 如果没有指定 variant2，默认比较当前配置和 variant1
  const file1 = variant1 === 'current' || !variant2 ? null : variant1;
  const file2 = variant1 === 'current' || !variant2 ? variant1 : variant2;

  const config1 = readConfig(service, file1);
  if (!config1.success) {
    console.error(chalk.red(`${t('error.prefix')}: ${t('diffCmd.errorReading', { file: file1 || t('diffCmd.current'), error: config1.error })}`));
    return 1;
  }

  const config2 = readConfig(service, file2);
  if (!config2.success) {
    console.error(chalk.red(`${t('error.prefix')}: ${t('diffCmd.errorReading', { file: file2, error: config2.error })}`));
    return 1;
  }

  const label1 = file1
    ? chalk.cyan(`${adapter.getBaseName()}.${file1}`)
    : chalk.cyan(`${adapter.getBaseName()} (${t('diffCmd.current')})`);
  const label2 = chalk.cyan(`${adapter.getBaseName()}.${file2}`);

  console.log(chalk.bold(`${t('diffCmd.comparing', { label1, label2 })}\n`));

  // 使用服务适配器的 diff 方法
  const path1 = file1 ? adapter.getVariantPath(file1) : adapter.getTargetPath();
  const path2 = adapter.getVariantPath(file2);
  const diffResult = adapter.diff(path1, path2);

  if (!diffResult.success) {
    console.error(chalk.red(`${t('diffCmd.diffFailed', { error: diffResult.error })}`));
    return 1;
  }

  // 格式化 diff 输出
  const diffOutput = diffResult.diff || '';

  if (!diffOutput || diffOutput.includes('  ') && !diffOutput.includes('+') && !diffOutput.includes('-')) {
    console.log(chalk.green(t('diffCmd.noDifferences')));
    return 0;
  }

  const lines = diffOutput.split('\n');
  for (const line of lines) {
    if (line.startsWith('+ ')) {
      console.log(chalk.green(line));
    } else if (line.startsWith('- ')) {
      console.log(chalk.red(line));
    } else {
      console.log(chalk.gray(line));
    }
  }

  return 0;
}
