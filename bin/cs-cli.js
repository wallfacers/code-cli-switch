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
import { initCommand } from '../src/commands/init.js';
import { undoCommand } from '../src/commands/undo.js';
import { completionCommand } from '../src/commands/completion.js';
import { auditLogCommand } from '../src/commands/audit.js';
import { listServices } from '../src/core/registry.js';
import { t, initI18n } from '../src/utils/i18n.js';

// 初始化国际化
initI18n();

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
  .name(t('cli.name'))
  .description(t('cli.description'))
  .version('0.2.0', '-v, --version', t('cli.version'))
  .addHelpText('beforeAll', () => `
${chalk.cyan.bold(t('app.header'))}
${chalk.cyan.bold(`     ${t('app.title')} (${t('cli.name')})                    `)}
${chalk.cyan.bold(t('app.footer'))}
`)
  .addHelpText('afterAll', () => `
${chalk.bold(`${t('cli.examples')}:`)}
  ${chalk.cyan('cs-cli')}                    ${t('defaultCmd.tuiMode')}
  ${chalk.cyan('cs-cli switch openai')}       ${t('help.switchClaude')}
  ${chalk.cyan('cs-cli switch prod -s gemini')} ${t('help.switchGemini')}
  ${chalk.cyan('cs-cli list')}               ${t('help.listAll')}
  ${chalk.cyan('cs-cli list -s claude')}     ${t('help.listClaude')}

${chalk.bold(`${t('cli.services')}:`)}
  ${chalk.cyan('claude')}  ${t('help.jsonFormat')}
  ${chalk.cyan('gemini')} ${t('help.envFormat')}
  ${chalk.cyan('codex')}  ${t('help.tomlFormat')}

${chalk.bold(`${t('cli.moreHelp')}:`)}
  ${chalk.cyan('cs-cli <command> -h')}     ${t('help.showHelp')}
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
  .description(t('config.variants'))
  .option('-s, --service <name>', t('option.filterByService'))
  .option('-a, --all', t('option.showAllServices'))
  .action(listCommand);

// switch 命令
program
  .command('switch')
  .alias('sw')
  .description(t('config.select'))
  .argument('<variant>', t('option.variantName'))
  .option('-s, --service <name>', t('option.serviceName'), 'claude')
  .option('--dry-run', t('option.dryRun'))
  .option('--no-backup', t('option.noBackup'))
  .action(switchCommand);

// current 命令
program
  .command('current')
  .description(t('config.active'))
  .option('-s, --service <name>', t('option.filterByService'))
  .option('-a, --all', t('option.showAllServices'))
  .action(currentCommand);

// diff 命令
program
  .command('diff')
  .description(t('diff.title'))
  .argument('[variant1]', t('option.firstVariant'))
  .argument('[variant2]', t('option.secondVariant'))
  .option('-s, --service <name>', t('option.serviceName'), 'claude')
  .action(diffCommand);

// backup 命令
program
  .command('backup')
  .description(t('backup.created'))
  .option('-s, --service <name>', t('option.serviceName'), 'claude')
  .option('-l, --list', t('option.listBackups'))
  .action(backupCommand);

// restore 命令
program
  .command('restore')
  .description(t('backup.restored'))
  .argument('[timestamp]', t('option.backupTimestamp'))
  .option('-s, --service <name>', t('option.serviceName'), 'claude')
  .action(restoreCommand);

// init 命令
program
  .command('init')
  .description('初始化配置')
  .argument('[service]', '编码工具', 'claude')
  .action(initCommand);

// undo 命令
program
  .command('undo')
  .description('撤销最后一次切换')
  .option('-s, --service <service>', '编码工具', 'claude')
  .action(undoCommand);

// completion 命令
program
  .command('completion')
  .description('生成 Shell 自动补全脚本')
  .argument('[shell]', 'Shell 类型 (bash/zsh/powershell/fish)')
  .option('-i, --install', '安装到系统')
  .option('-o, --output <path>', '输出文件路径')
  .action(completionCommand);

// audit 命令
program
  .command('audit')
  .description('查看审计日志')
  .option('-s, --service <service>', '过滤服务')
  .option('-a, --action <action>', '过滤操作类型')
  .option('-n, --limit <number>', '显示条数', '10')
  .action(auditLogCommand);

// 解析命令行参数
program.parse();
