# Claude Launch Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modify cs-cli switch command to directly launch Claude process with `--settings` flag, enabling multi-window configuration isolation.

**Architecture:** Claude service uses `claude --settings ~/.claude/settings.json.xxx` to start process. Gemini/Codex services keep original file-overwrite behavior. Remove current/undo commands and active state concept.

**Tech Stack:** Node.js, commander.js, child_process.spawn

---

## Task 1: Remove current and undo commands from CLI

**Files:**
- Modify: `bin/cs-cli.js:116-137`

**Step 1: Remove current command registration**

Delete lines 83-89 (current command):

```javascript
// 删除以下代码
// current 命令
program
  .command('current')
  .description(t('config.active'))
  .option('-s, --service <name>', t('option.filterByService'))
  .option('-a, --all', t('option.showAllServices'))
  .action(currentCommand);
```

**Step 2: Remove undo command registration**

Delete lines 123-128 (undo command):

```javascript
// 删除以下代码
// undo 命令
program
  .command('undo')
  .description('撤销最后一次切换')
  .option('-s, --service <service>', '编码工具', 'claude')
  .action(undoCommand);
```

**Step 3: Remove imports for deleted commands**

Remove these imports at top of file:

```javascript
// 删除以下两行
import { currentCommand } from '../src/commands/current.js';
import { undoCommand } from '../src/commands/undo.js';
```

**Step 4: Verify CLI still works**

Run: `node bin/cs-cli.js --help`
Expected: No current or undo command in help output

**Step 5: Commit**

```bash
git add bin/cs-cli.js
git commit -m "refactor: remove current and undo commands from CLI"
```

---

## Task 2: Delete command files

**Files:**
- Delete: `src/commands/current.js`
- Delete: `src/commands/undo.js`

**Step 1: Delete files**

```bash
rm src/commands/current.js
rm src/commands/undo.js
```

**Step 2: Verify no broken imports**

Run: `node bin/cs-cli.js --help`
Expected: No errors

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete current.js and undo.js files"
```

---

## Task 3: Simplify list command - remove active state

**Files:**
- Modify: `src/commands/list.js`

**Step 1: Simplify listOverview function**

Replace `listOverview` function (lines 40-64):

```javascript
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
```

**Step 2: Simplify listServiceVariants function**

Replace `listServiceVariants` function (lines 84-133):

```javascript
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
```

**Step 3: Remove unused imports**

Remove unused imports at top:
```javascript
// 删除
import { getCurrentStatus, getAllStatus } from '../core/config.js';
import { toChinaTimeZoneString } from '../utils/date.js';
import fs from 'node:fs';
```

**Step 4: Verify list command works**

Run: `node bin/cs-cli.js list`
Expected: List of variants without active markers

**Step 5: Commit**

```bash
git add src/commands/list.js
git commit -m "refactor: simplify list command, remove active state display"
```

---

## Task 4: Modify switch command for Claude launch

**Files:**
- Modify: `src/commands/switch.js`

**Step 1: Add spawn import**

Add at top of file:

```javascript
import { spawn } from 'node:child_process';
```

**Step 2: Add Claude launch function**

Add new function before `switchCommand`:

```javascript
/**
 * Launch Claude process with specified settings file
 * @param {string} settingsPath - Path to settings.json.xxx
 * @returns {Promise<number>} Exit code
 */
async function launchClaude(settingsPath) {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--settings', settingsPath], {
      stdio: 'inherit',
      shell: true
    });

    claude.on('close', (code) => {
      resolve(code || 0);
    });

    claude.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error(chalk.red('Error: claude command not found'));
        console.log(chalk.gray('Please install Claude CLI first'));
      } else {
        console.error(chalk.red(`Error: ${err.message}`));
      }
      resolve(1);
    });
  });
}
```

**Step 3: Modify switchCommand for Claude service**

Replace the entire `switchCommand` function:

```javascript
/**
 * switch 命令 - 切换配置
 * @param {string} variant - 配置变体名称
 * @param {object} options - { service: string, dryRun: boolean, noBackup: boolean }
 */
export async function switchCommand(variant, options = {}) {
  const { service = 'claude', dryRun = false, noBackup = false } = options;

  // 验证服务是否存在
  const adapter = getAdapter(service);
  if (!adapter) {
    console.error(chalk.red(t('switch.unknownService', { name: service })));
    console.log(chalk.yellow(`${t('switch.availableServices')}:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  if (!variant) {
    console.error(chalk.red(t('switch.missingVariant')));
    console.log(chalk.gray(t('switch.usage')));
    return 1;
  }

  // Claude 服务：直接启动进程
  if (service === 'claude') {
    return handleClaudeSwitch(adapter, variant, dryRun);
  }

  // 其他服务：保持原有行为
  const result = switchConfig(service, variant, { dryRun, noBackup });

  logSwitch(service, variant, result.success);

  if (!result.success) {
    console.error(chalk.red(`${t('error.prefix')}: ${result.error}`));

    if (result.suggestions && result.suggestions.length > 0) {
      console.log(chalk.yellow(`\n${t('switch.availableVariants')}:`));
      for (const s of result.suggestions) {
        console.log(`  - ${s}`);
      }
    }

    return 1;
  }

  if (result.dryRun) {
    console.log(chalk.yellow(t('switch.dryRun')), result.message);
    console.log(chalk.gray(`  ${t('switch.source')}: ${result.source}`));
    console.log(chalk.gray(`  ${t('switch.target')}: ${result.target}`));
    return 0;
  }

  console.log(chalk.green('✓ '), result.message);

  if (result.backup) {
    console.log(chalk.gray(`  ${t('backup.path')}: ${result.backup}`));
  }

  return 0;
}

/**
 * 处理 Claude 服务的切换（启动进程）
 * @param {object} adapter - Claude adapter
 * @param {string} variant - 配置变体名称
 * @param {boolean} dryRun - 是否预览模式
 * @returns {Promise<number>} Exit code
 */
async function handleClaudeSwitch(adapter, variant, dryRun) {
  const sourcePath = adapter.getVariantPath(variant);

  // 1. 检查文件是否存在
  if (!sourcePath) {
    console.error(chalk.red(`${t('error.prefix')}: Configuration variant "${variant}" not found`));
    const variants = adapter.scanVariants();
    if (variants.length > 0) {
      console.log(chalk.yellow(`\n${t('switch.availableVariants')}:`));
      for (const v of variants) {
        console.log(`  - ${v.name}`);
      }
    }
    return 1;
  }

  // 2. 验证格式
  const validation = adapter.validate(sourcePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';
    console.error(chalk.red(`${t('error.prefix')}: Invalid format in ${adapter.getBaseName()}.${variant}: ${errorMsg}`));
    return 1;
  }

  // 3. 预览模式
  if (dryRun) {
    console.log(chalk.yellow(t('switch.dryRun')), `Would launch claude with: ${sourcePath}`);
    return 0;
  }

  // 4. 启动 Claude
  console.log(chalk.green('✓ '), `Launching Claude with ${variant} configuration...`);
  return launchClaude(sourcePath);
}
```

**Step 4: Remove unused import**

Remove:
```javascript
import { logSwitch } from '../utils/logger.js';
```

**Step 5: Verify switch help**

Run: `node bin/cs-cli.js switch --help`
Expected: Help output without errors

**Step 6: Commit**

```bash
git add src/commands/switch.js
git commit -m "feat: Claude switch now launches process with --settings flag"
```

---

## Task 5: Update tests

**Files:**
- Modify: `tests/integration/switch-flow.test.js`
- Modify: `tests/unit/history.test.js`

**Step 1: Check and update switch-flow tests**

Read the test file and identify tests that:
- Test `current` command behavior
- Test `undo` command behavior
- Test active state in `list` output

Remove or update these tests as needed.

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: update tests for launch mode changes"
```

---

## Task 6: Update README

**Files:**
- Modify: `README.md`

**Step 1: Remove current and undo command documentation**

Remove sections:
- `cs-cli current` examples
- `cs-cli undo` examples

**Step 2: Update switch command documentation**

Update to reflect new behavior:
- Claude: launches process
- Gemini/Codex: keeps file overwrite behavior

**Step 3: Update list command documentation**

Remove references to active state markers.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README for launch mode"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `cs-cli switch glm` launches Claude process
- [ ] `cs-cli switch prod -s gemini` still overwrites file
- [ ] `cs-cli list` shows variants without active markers
- [ ] `cs-cli current` returns "unknown command"
- [ ] `cs-cli undo` returns "unknown command"
- [ ] All tests pass
- [ ] README updated

---

## Final Commit

```bash
git add -A
git commit -m "feat: implement Claude launch mode for configuration isolation

- Claude switch now launches process with --settings flag
- Remove current and undo commands
- Simplify list output (no active state)
- Gemini/Codex keep original file-overwrite behavior

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
