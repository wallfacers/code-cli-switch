import * as inquirer from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { getAdapter } from '../core/registry.js';

/**
 * 初始化指定服务的配置
 * @param {string} service - 服务标识
 */
export async function initCommand(service = 'claude') {
  console.log(chalk.cyan(`\n🚀 Initializing ${service} configuration...\n`));

  const adapter = getAdapter(service);
  if (!adapter) {
    console.log(chalk.red(`Unknown service: ${service}`));
    return { success: false, error: `Unknown service: ${service}` };
  }

  const configDir = adapter.getConfigDir();

  // 1. 检查并创建配置目录
  if (!fs.existsSync(configDir)) {
    const { shouldCreate } = await inquirer.prompt({
      type: 'confirm',
      name: 'shouldCreate',
      message: `Create config directory at ${configDir}?`,
      default: true
    });

    if (shouldCreate) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(chalk.green('✓ Directory created'));
    } else {
      console.log(chalk.gray('Init cancelled'));
      return { success: false, cancelled: true };
    }
  }

  // 2. 检查现有配置
  const targetPath = adapter.getTargetPath();
  if (fs.existsSync(targetPath)) {
    console.log(chalk.yellow(`\n⚠ Existing config found at ${targetPath}`));

    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Create a new variant from existing config', value: 'variant' },
        { name: 'Overwrite existing config (not recommended)', value: 'overwrite' },
        { name: 'Cancel', value: 'cancel' }
      ]
    });

    if (action === 'cancel') {
      return { success: false, cancelled: true };
    }
    if (action === 'variant') {
      return await createVariant(adapter, targetPath);
    }
  }

  // 3. 创建示例配置
  return await createExampleConfig(adapter, targetPath);
}

/**
 * 从现有配置创建变体
 */
async function createVariant(adapter, targetPath) {
  const { variantName } = await inquirer.prompt({
    type: 'input',
    name: 'variantName',
    message: 'Enter variant name (e.g., openai, local):',
    validate: input => input.trim().length > 0 || 'Name cannot be empty'
  });

  const variantPath = adapter.getVariantPath(variantName);
  fs.copyFileSync(targetPath, variantPath);

  console.log(chalk.green(`✓ Created variant: ${variantPath}`));
  return { success: true, variant: variantName };
}

/**
 * 创建示例配置
 */
async function createExampleConfig(adapter, targetPath) {
  const examples = getServiceExamples();
  const service = adapter.id;
  const example = examples[service];

  if (!example) {
    console.log(chalk.yellow(`No example available for ${service}`));
    return { success: false, error: 'No example available' };
  }

  console.log(chalk.cyan('\n📝 Creating example configuration:\n'));
  console.log(chalk.gray(example.comment));

  const { confirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Create this example config?',
    default: true
  });

  if (confirm) {
    fs.writeFileSync(targetPath, example.content);
    console.log(chalk.green(`✓ Created: ${targetPath}`));
    console.log(chalk.yellow('\n⚠ Please edit the config with your actual credentials'));
    return { success: true };
  }

  return { success: false, cancelled: true };
}

/**
 * 获取服务示例配置
 */
export function getServiceExamples() {
  return {
    claude: {
      comment: '# Example Claude settings.json',
      content: JSON.stringify({
        api_key: 'sk-ant-your-key-here',
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200000
      }, null, 2)
    },
    gemini: {
      comment: '# Example Gemini .env',
      content: 'GEMINI_API_KEY=your-key-here\n'
    },
    codex: {
      comment: '# Example Codex config.toml',
      content: 'env_key = "sk-your-key-here"\n'
    }
  };
}
