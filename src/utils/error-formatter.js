import chalk from 'chalk';

/**
 * 格式化配置未找到错误
 * @param {string} service - 服务标识
 * @param {string} variant - 变体名称
 * @param {object} adapter - 服务适配器
 * @returns {{title: string, details: Array<string>, suggestions: Array<string>}}
 */
export function formatVariantNotFoundError(service, variant, adapter) {
  const targetDir = adapter.getConfigDir();
  const expectedPath = adapter.getVariantPath(variant);
  const availableVariants = adapter.scanVariants();

  return {
    title: chalk.red('Configuration variant not found'),
    details: [
      chalk.gray(`Service: ${service}`),
      chalk.gray(`Variant: ${variant}`),
      chalk.gray(`Expected path: ${expectedPath}`),
      '',
      chalk.yellow('Available variants:'),
      ...availableVariants.map(v => chalk.gray(`  - ${v.name}`))
    ],
    suggestions: [
      `Check the file exists at: ${expectedPath}`,
      `Ensure the directory exists: ${targetDir}`,
      `Available variants: ${availableVariants.map(v => v.name).join(', ')}`
    ]
  };
}

/**
 * 格式化验证错误（带上下文）
 * @param {string} filePath - 文件路径
 * @param {Error} error - 错误对象
 * @returns {{title: string, details: Array<string>, suggestions: Array<string>}}
 */
export function formatValidationError(filePath, error) {
  return {
    title: chalk.red('Configuration validation failed'),
    details: [
      chalk.gray(`File: ${filePath}`),
      '',
      chalk.yellow('Error:'),
      chalk.gray(`  ${error.message}`)
    ],
    suggestions: [
      'Check the file syntax',
      'Ensure all required fields are present',
      `Run: cs-cli validate ${filePath}`
    ]
  };
}

/**
 * 输出格式化的错误信息
 * @param {object} formattedError - 格式化后的错误对象
 */
export function printError(formattedError) {
  console.log(`\n${formattedError.title}`);
  if (formattedError.details) {
    console.log(formattedError.details.join('\n'));
  }
  if (formattedError.suggestions) {
    console.log(chalk.yellow('\nSuggestions:'));
    console.log(formattedError.suggestions.map(s => `  ${s}`).join('\n'));
  }
  console.log();
}
