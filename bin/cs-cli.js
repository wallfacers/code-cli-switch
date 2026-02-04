#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { defaultCommand } from '../src/commands/default.js';
import { listCommand } from '../src/commands/list.js';
import { switchCommand } from '../src/commands/switch.js';
import { currentCommand } from '../src/commands/current.js';
import { diffCommand } from '../src/commands/diff.js';
import { backupCommand } from '../src/commands/backup.js';
import { restoreCommand } from '../src/commands/restore.js';
import { interactiveCommand } from '../src/commands/interactive.js';
import { listServices } from '../src/core/registry.js';

const program = new Command();

// 获取当前配置目录提示
function showConfigHint() {
  const hints = [];
  for (const { id } of listServices()) {
    const envVar = id === 'claude' ? 'CLAUDE_CONFIG_DIR' : `${id.toUpperCase()}_CONFIG_DIR`;
    hints.push(chalk.gray(`${id}: ${envVar}`));
  }
  return hints.join('\n');
}

program
  .name('cs-cli')
  .description('Multi-service CLI configuration switcher')
  .version('0.2.0', '-v, --version', 'Display version number')
  .addHelpText('beforeAll', `
${chalk.cyan.bold('═══════════════════════════════════════════════════════')}
${chalk.cyan.bold('     Configuration Switcher (cs-cli)                    ')}
${chalk.cyan.bold('═══════════════════════════════════════════════════════')}
`)
  .addHelpText('afterAll', `
${chalk.bold('Examples:')}
  ${chalk.cyan('cs-cli')}                    Interactive selection
  ${chalk.cyan('cs-cli switch openai')}       Switch Claude config
  ${chalk.cyan('cs-cli switch prod -s gemini')} Switch Gemini config
  ${chalk.cyan('cs-cli list')}               List all services overview
  ${chalk.cyan('cs-cli list -s claude')}     List Claude variants

${chalk.bold('Services:')}
  ${chalk.cyan('claude')}  JSON format (settings.json.xxx)
  ${chalk.cyan('gemini')} ENV format (.env.xxx)
  ${chalk.cyan('codex')}  TOML format (config.toml.xxx)

${chalk.bold('For more help:')}
  ${chalk.cyan('cs-cli <command> -h')}     Show help for a specific command
`);

// 当没有子命令时，执行默认的交互式选择
program.action(async () => {
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
  await defaultCommand();
});

// ─────────────────────────────────────────────────────────────
// 命令定义
// ═════════════════════════════════════════════════════════════

// list 命令
program
  .command('list')
  .alias('ls')
  .description('List all available configuration variants')
  .option('-s, --service <name>', 'Filter by service (claude, gemini, codex)')
  .option('-a, --all', 'Show all services with their variants')
  .action(listCommand);

// switch 命令
program
  .command('switch')
  .alias('sw')
  .description('Switch to a different configuration')
  .argument('<variant>', 'Configuration variant name')
  .option('-s, --service <name>', 'Service name (claude, gemini, codex)', 'claude')
  .option('--dry-run', 'Preview the switch without actually changing')
  .option('--no-backup', 'Skip creating a backup before switching')
  .action(switchCommand);

// current 命令
program
  .command('current')
  .description('Show the currently active configuration')
  .option('-s, --service <name>', 'Filter by service (claude, gemini, codex)')
  .option('-a, --all', 'Show all services')
  .action(currentCommand);

// diff 命令
program
  .command('diff')
  .description('Compare two configurations')
  .argument('[variant1]', 'First variant')
  .argument('[variant2]', 'Second variant')
  .option('-s, --service <name>', 'Service name (claude, gemini, codex)', 'claude')
  .action(diffCommand);

// backup 命令
program
  .command('backup')
  .description('Create a backup of the current configuration')
  .option('-s, --service <name>', 'Service name (claude, gemini, codex)', 'claude')
  .option('-l, --list', 'List all backups after creating')
  .action(backupCommand);

// restore 命令
program
  .command('restore')
  .description('Restore a configuration from backup')
  .argument('[timestamp]', 'Backup timestamp')
  .option('-s, --service <name>', 'Service name (claude, gemini, codex)', 'claude')
  .action(restoreCommand);

// interactive 命令
program
  .command('interactive')
  .alias('ui')
  .alias('tui')
  .description('Launch interactive TUI interface')
  .action(interactiveCommand);

// 解析命令行参数
program.parse();
