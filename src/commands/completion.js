import { generateCompletionScript } from '../core/completion.js';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 生成或安装 Shell 补全脚本
 * @param {string} shell - Shell 类型
 * @param {object} options - { install: boolean, output: string, words: string }
 */
export function completionCommand(shell, options = {}) {
  // 处理内部查询（由补全脚本调用）
  if (shell === '--query') {
    const words = options.words || '';
    const current = options.current || '';
    const completions = getCompletions(current, words);
    console.log(completions.join(' '));
    return { success: true };
  }

  const { getCompletions } = require('../core/completion.js');

  // 确定默认 shell
  if (!shell) {
    shell = detectShell();
  }

  // 生成或安装补全脚本
  if (options.install) {
    return installCompletion(shell, options.output);
  }

  const script = generateCompletionScript(shell);
  console.log(script);
  console.log(chalk.gray(`\n# Add to your shell config, or run: cs-cli completion ${shell} --install`));

  return { success: true };
}

/**
 * 检测当前 Shell
 */
function detectShell() {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (process.platform === 'win32') return 'powershell';
  return 'bash';
}

/**
 * 安装补全脚本
 */
function installCompletion(shell, outputPath) {
  const script = generateCompletionScript(shell);

  // 默认输出路径
  let targetPath = outputPath;
  if (!targetPath) {
    const homeDir = require('os').homedir();
    const paths = {
      bash: path.join(homeDir, '.cs-cli', 'completion.bash'),
      zsh: path.join(homeDir, '.cs-cli', 'completion.zsh'),
      powershell: path.join(homeDir, '.cs-cli', 'completion.ps1'),
      fish: path.join(homeDir, '.config', 'fish', 'completions', 'cs-cli.fish')
    };
    targetPath = paths[shell] || paths.bash;
  }

  // 确保目录存在
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 写入脚本
  fs.writeFileSync(targetPath, script);

  const instructions = {
    bash: `Add to ~/.bashrc: source ${targetPath}`,
    zsh: `Add to ~/.zshrc: source ${targetPath}`,
    powershell: `Add to \$PROFILE: . ${targetPath}`,
    fish: `File already in correct location`
  };

  console.log(chalk.green(`✓ Completion script installed to: ${targetPath}`));
  console.log(chalk.yellow(instructions[shell]));

  return { success: true, path: targetPath, instructions: instructions[shell] };
}
