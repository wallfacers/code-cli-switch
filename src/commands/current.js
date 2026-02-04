import chalk from 'chalk';
import { readConfig } from '../core/config.js';
import { getCurrentStatus, getAllStatus } from '../core/config.js';
import { getAdapter, listServices } from '../core/registry.js';

/**
 * current 命令 - 显示当前生效配置
 * @param {object} options - { service: string, all: boolean }
 */
export async function currentCommand(options = {}) {
  const { service = null, all = false } = options;

  // 如果指定了 --all，显示所有服务的当前配置
  if (all) {
    return showAllCurrent();
  }

  // 如果没有指定服务，显示所有服务的概览
  if (!service) {
    return showCurrentOverview();
  }

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(`Error: Unknown service "${service}"`));
    console.log(chalk.yellow('Available services:'), listServices().map(s => s.id).join(', '));
    return 1;
  }

  return showServiceCurrent(service);
}

/**
 * 显示所有服务的当前配置概览
 */
async function showCurrentOverview() {
  const allStatus = getAllStatus();

  console.log(chalk.bold('Current configurations:\n'));

  for (const status of allStatus) {
    const adapter = getAdapter(status.service);
    if (!adapter) continue;

    if (status.current) {
      console.log(`  ${chalk.cyan(status.service.padEnd(8))} ${chalk.green(status.current)}`);
      if (status.lastModified) {
        console.log(`  ${''.padEnd(8)} ${chalk.gray(status.lastModified)}`);
      }
    } else {
      console.log(`  ${chalk.cyan(status.service.padEnd(8))} ${chalk.gray('(not set)')}`);
    }
  }

  console.log();
  console.log(chalk.gray('Use --service <name> to show details for a specific service.'));

  return 0;
}

/**
 * 显示所有服务的详细当前配置
 */
async function showAllCurrent() {
  const services = listServices();

  for (const { id } of services) {
    console.log(chalk.bold(`\n${id.toUpperCase()}:\n`));
    await showServiceCurrent(id);
  }

  return 0;
}

/**
 * 显示指定服务的当前配置
 * @param {string} service
 */
async function showServiceCurrent(service) {
  const adapter = getAdapter(service);
  const status = getCurrentStatus(service);

  if (!status.current) {
    console.log(chalk.yellow(`No active configuration set for ${service}.`));
    console.log(chalk.gray(`Use "cs-cli switch <variant> --service ${service}" to activate a configuration.`));
    return 0;
  }

  console.log(chalk.bold(`${adapter.name} current configuration:`), chalk.cyan(status.current));

  if (status.lastModified) {
    console.log(chalk.gray('Last modified:'), status.lastModified);
  }

  if (status.hash) {
    console.log(chalk.gray('Content hash:'), status.hash);
  }

  // 显示配置内容摘要
  const config = readConfig(service, null);
  if (config.success && config.data) {
    console.log();
    console.log(chalk.bold('Configuration summary:'));

    // Claude 特有字段
    if (config.data.providers) {
      console.log(chalk.gray('  Providers:'), config.data.providers.length);
    }
    if (config.data.model) {
      console.log(chalk.gray('  Model:'), config.data.model);
    }

    // 通用：显示所有键的数量
    const keys = Object.keys(config.data);
    if (keys.length > 0 && !config.data.providers && !config.data.model) {
      console.log(chalk.gray('  Keys:'), keys.length);
    }
  }

  return 0;
}
