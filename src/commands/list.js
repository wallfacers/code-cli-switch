import chalk from 'chalk';
import fs from 'node:fs';
import { scanVariants, scanAllVariants, getCurrentStatus, getAllStatus } from '../core/config.js';
import { getAdapter, listServices } from '../core/registry.js';
import { toChinaTimeZoneString } from '../utils/date.js';

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
    console.error(chalk.red(`Error: Unknown service "${service}"`));
    console.log(chalk.yellow('Available services:'), listServices().map(s => s.id).join(', '));
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
  const allStatus = getAllStatus();

  console.log(chalk.bold('Services:\n'));

  for (const { id, name } of services) {
    const status = allStatus.find(s => s.service === id);
    const variants = scanVariants(id);
    const activeVariant = variants.find(v => v.active);

    // 优先使用状态文件记录的配置，如果没有则使用文件哈希匹配的结果
    const currentName = status?.current || activeVariant?.name;
    const currentInfo = currentName
      ? chalk.green(`(current: ${currentName})`)
      : chalk.gray('(no active config)');

    console.log(`  ${chalk.cyan(id.padEnd(8))} ${name} - ${variants.length} variants ${currentInfo}`);
  }

  console.log();
  console.log(chalk.gray('Use --service <name> to list variants for a specific service.'));

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
  const status = getCurrentStatus(service);

  if (variants.length === 0) {
    console.log(chalk.yellow(`  No configuration variants found for ${service}.`));
    console.log(chalk.gray(`  Create a file like ${adapter.getBaseName()}.<variant> in ${adapter.getConfigDir()}`));
    return 0;
  }

  console.log(chalk.bold(`${adapter.name} configurations:\n`));

  // 找出活跃的变体（通过哈希匹配）
  const activeVariant = variants.find(v => v.active);

  for (const variant of variants) {
    // 同时检查哈希匹配和状态文件记录
    const isActive = variant.active || status.current === variant.name;
    const prefix = isActive ? chalk.green('●') : ' ';
    const suffix = isActive ? chalk.green('(currently active)') : '';

    console.log(`  ${prefix} ${chalk.cyan(variant.name)} ${suffix}`);
  }

  // 显示当前状态 - 优先使用状态文件，否则使用哈希匹配结果
  const currentName = status.current || activeVariant?.name;
  if (currentName) {
    console.log(`\n${chalk.gray('Current:')} ${chalk.cyan(currentName)}`);

    // 显示修改时间 - 优先使用状态文件记录，否则使用目标文件的修改时间
    let lastModified = status.lastModified;
    if (!lastModified) {
      const targetPath = adapter.getTargetPath();
      if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        lastModified = toChinaTimeZoneString(new Date(stats.mtime));
      }
    }
    if (lastModified) {
      console.log(`${chalk.gray('Last modified:')} ${lastModified}`);
    }
  }

  return 0;
}
