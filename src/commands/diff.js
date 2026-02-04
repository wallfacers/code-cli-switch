import chalk from 'chalk';
import { readConfig } from '../core/config.js';
import { getConfigDir, validateConfigDir } from '../utils/path.js';
import { diffLines } from 'diff';

/**
 * 格式化 JSON 用于比较
 */
function formatJson(obj) {
  return JSON.stringify(obj, null, 2);
}

/**
 * 比较两个配置
 */
export async function diffCommand(variant1, variant2 = null) {
  // 检查配置目录
  if (!validateConfigDir()) {
    console.error(chalk.red(`Config directory not found: ${getConfigDir()}`));
    return 1;
  }

  const config1 = readConfig(variant1);
  if (!config1.success) {
    console.error(chalk.red(`Error reading ${variant1 || 'current'}: ${config1.error}`));
    return 1;
  }

  const config2 = readConfig(variant2);
  if (!config2.success) {
    console.error(chalk.red(`Error reading ${variant2}: ${config2.error}`));
    return 1;
  }

  const label1 = variant1 ? chalk.cyan(`settings.json.${variant1}`) : chalk.cyan('settings.json (current)');
  const label2 = chalk.cyan(`settings.json.${variant2}`);

  console.log(chalk.bold(`Comparing ${label1} ${chalk.gray('vs')} ${label2}\n`));

  const json1 = formatJson(config1.data);
  const json2 = formatJson(config2.data);

  if (json1 === json2) {
    console.log(chalk.green('No differences found.'));
    return 0;
  }

  const diff = diffLines(json1, json2);

  for (const part of diff) {
    const lines = part.value.split('\n').filter(l => l);
    if (lines.length === 0) continue;

    if (part.added) {
      for (const line of lines) {
        console.log(chalk.green(`+ ${line}`));
      }
    } else if (part.removed) {
      for (const line of lines) {
        console.log(chalk.red(`- ${line}`));
      }
    } else {
      for (const line of lines) {
        console.log(chalk.gray(`  ${line}`));
      }
    }
  }

  return 0;
}
