import chalk from 'chalk';
import { scanVariants } from '../core/config.js';
import { getAdapter, listServices } from '../core/registry.js';
import { t } from '../utils/i18n.js';

/**
 * list 命令 - 列出所有可用配置
 * @param {object} options - { service: string, all: boolean }
 */
export async function listCommand(options = {}) {
  const { service = null, all = false } = options;

  // 如果指定了 --all，显示所有服务的配置
  if (all) {
    return listAllServices();
  }

  // 如果没有指定服务，显示所有服务的概览
  if (!service) {
    return listOverview();
  }

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(t('switch.unknownService', { name: service })));
    console.log(chalk.yellow(`${t('switch.availableServices')}:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  // 列出指定服务的配置
  return listServiceVariants(service);
}

/**
 * 列出所有服务的概览
 */
async function listOverview() {
  const services = listServices();

  console.log(chalk.bold(`${t('list.services')}:\n`));

  for (const { id, name } of services) {
    const variants = scanVariants(id);

    console.log(`  ${chalk.cyan(id.padEnd(8))} ${name} - ${variants.length} ${t('list.variants')}`);
  }

  console.log();
  console.log(chalk.gray(t('list.useService')));

  return 0;
}

/**
 * 列出所有服务的详细配置
 */
async function listAllServices() {
  const services = listServices();

  for (const { id, name } of services) {
    console.log(chalk.bold(`\n${name} (${id}):\n`));
    await listServiceVariants(id);
  }

  return 0;
}

/**
 * 列出指定服务的配置变体
 * @param {string} service
 */
async function listServiceVariants(service) {
  const adapter = getAdapter(service);
  if (!adapter) {
    return 1;
  }

  const variants = scanVariants(service);

  if (variants.length === 0) {
    console.log(chalk.yellow(`  ${t('list.noVariantsFound', { service })}.`));
    console.log(chalk.gray(`  ${t('list.createHint', { basename: adapter.getBaseName(), dir: adapter.getConfigDir() })}`));
    return 0;
  }

  console.log(chalk.bold(`${adapter.name} ${t('list.configurations')}:\n`));

  for (const variant of variants) {
    console.log(`  ${chalk.cyan(variant.name)}`);
  }

  return 0;
}
