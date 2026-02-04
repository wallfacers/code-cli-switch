#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { defaultCommand } from '../src/commands/default.js';
import { listCommand } from '../src/commands/list.js';
import { switchCommand } from '../src/commands/switch.js';
import { currentCommand } from '../src/commands/current.js';
import { diffCommand } from '../src/commands/diff.js';
import { backupCommand, listBackupsCommand } from '../src/commands/backup.js';
import { restoreCommand } from '../src/commands/restore.js';
import { interactiveCommand } from '../src/commands/interactive.js';
import { getConfigDir } from '../src/utils/path.js';

const program = new Command();

// 配置目录提示
function showConfigHint() {
  const configDir = getConfigDir();
  return chalk.gray(`Config: ${configDir}`);
}

program
  .name('cs-cli')
  .description('Claude Settings CLI - Switch between Claude Code configurations')
  .version('0.1.0', '-v, --version', 'Display version number')
  .addHelpText('beforeAll', `
${chalk.cyan.bold('═══════════════════════════════════════════════════════')}
${chalk.cyan.bold('           Claude Settings CLI (cs-cli)               ')}
${chalk.cyan.bold('═══════════════════════════════════════════════════════')}
${showConfigHint()}
`)
  .addHelpText('afterAll', `
${chalk.bold('Examples:')}
  ${chalk.cyan('cs-cli')}              Interactive selection (↑/↓ to choose)
  ${chalk.cyan('cs-cli switch openai')} Switch to OpenAI configuration
  ${chalk.cyan('cs-cli list')}         List all available configurations
  ${chalk.cyan('cs-cli diff')}         Compare current with another variant

${chalk.bold('Config file naming:')}
  ${chalk.gray('settings.json.<variant>')}  e.g., settings.json.openai

${chalk.bold('For more help:')}
  ${chalk.cyan('cs-cli <command> -h')}     Show help for a specific command
`);

// 当没有子命令时，执行默认的交互式选择
program.action(async () => {
  // 清理屏幕并移动光标到顶部
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
  .action(listCommand);

// switch 命令
program
  .command('switch')
  .alias('sw')
  .description('Switch to a different configuration')
  .argument('<variant>', 'Configuration variant name (e.g., openai, zipu)')
  .option('--dry-run', 'Preview the switch without actually changing')
  .option('--no-backup', 'Skip creating a backup before switching')
  .action(switchCommand);

// current 命令
program
  .command('current')
  .description('Show the currently active configuration details')
  .action(currentCommand);

// diff 命令
program
  .command('diff')
  .description('Compare two configurations and show differences')
  .argument('[variant1]', 'First variant (omit to compare current vs another)')
  .argument('[variant2]', 'Second variant (omit to compare current vs variant1)')
  .action(diffCommand);

// backup 命令
program
  .command('backup')
  .description('Create a backup of the current configuration')
  .option('-l, --list', 'List all backups after creating')
  .action(backupCommand);

// restore 命令
program
  .command('restore')
  .description('Restore a configuration from backup')
  .argument('[timestamp]', 'Backup timestamp (omit for latest backup)')
  .action(restoreCommand);

// interactive 命令
program
  .command('interactive')
  .alias('ui')
  .alias('tui')
  .description('Launch interactive TUI interface with full keyboard control')
  .action(interactiveCommand);

// 添加全局选项
program
  .option('-c, --config-dir <path>', 'Override config directory (sets CLAUDE_CONFIG_DIR)')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options.configDir) {
      process.env.CLAUDE_CONFIG_DIR = options.configDir;
    }
  });

// 解析命令行参数
program.parse();
