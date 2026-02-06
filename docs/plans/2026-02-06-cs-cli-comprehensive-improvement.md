# cs-cli 全面改进计划 - 设计文档

**日期**: 2026-02-06
**版本**: 0.2.0
**状态**: 设计完成，待实施

---

## 概述

本计划涵盖 12 个改进项，基于多角度评审（UX 专家、架构专家、批判者）的分析结果，分为高/中/低三个优先级。

### 改进项总览

| 优先级 | 改进项 | 关键决策 |
|--------|--------|----------|
| 🔴 高 | 原子操作 | 使用原生 rename API |
| 🔴 高 | 进程隔离 | 每个进程独有目录操作 |
| 🔴 高 | 测试覆盖 | 新增 20+ 测试用例 |
| 🔴 高 | 语义验证 | 基础结构验证（api_key 必需） |
| 🟡 中 | init 命令 | 交互式初始化向导 |
| 🟡 中 | 错误信息 | 显示路径、上下文、建议 |
| 🟡 中 | 交互恢复 | 选择器替代时间戳输入 |
| 🟡 中 | 撤销/历史 | 基于备份历史实现 |
| 🟢 低 | Shell 补全 | 动态补全工具名和变体名 |
| 🟢 低 | 配置预览 | 切换前显示变更摘要 |
| 🟢 低 | 审计日志 | 记录所有切换操作 |

---

## 模块结构

### 新增模块

```
src/
├── core/
│   ├── atomic.js              # 原子操作封装
│   ├── isolation.js           # 进程隔离管理
│   ├── semantic-validator.js  # 语义验证
│   ├── history.js             # 历史/撤销功能
│   ├── preview.js             # 配置预览
│   └── completion.js          # Shell 补全核心
├── commands/
│   ├── init.js                # 初始化命令
│   ├── undo.js                # 撤销命令
│   ├── completion.js          # Shell 补全命令
│   └── audit.js               # 审计日志命令
└── utils/
    ├── error-formatter.js     # 错误格式化
    └── logger.js              # 审计日志
```

### 测试结构

```
tests/
├── unit/
│   ├── atomic.test.js          # 原子操作测试
│   ├── isolation.test.js       # 进程隔离测试
│   ├── semantic-validator.test.js  # 语义验证测试
│   └── history.test.js         # 历史/撤销测试
├── integration/
│   ├── switch-flow.test.js     # 完整切换流程测试
│   ├── concurrent.test.js      # 并发测试
│   └── error-recovery.test.js  # 错误恢复测试
├── e2e/
│   ├── init-workflow.test.js   # init 命令端到端测试
│   └── undo-workflow.test.js   # 撤销流程测试
└── fixtures/
    ├── configs/                 # 测试配置文件
    └── mock-fs.js              # 文件系统模拟
```

---

## 第一部分：原子操作

### 设计

使用原生 rename API 实现真正的原子性：

```javascript
// src/core/atomic.js
import fs from 'node:fs';

/**
 * 平台相关的原子替换
 * Windows: 删除后重命名
 * Unix: rename() 系统调用（原子）
 */
export function atomicReplace(sourcePath, targetPath) {
  if (process.platform === 'win32') {
    // Windows: 先删除目标文件，然后重命名
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(sourcePath, targetPath);
  } else {
    // Unix: rename() 原子替换
    fs.renameSync(sourcePath, targetPath);
  }
}

/**
 * 安全的原子切换流程
 * 1. 复制源文件到临时文件
 * 2. 原子性替换目标文件
 * 3. 失败时清理临时文件
 */
export function atomicSwitch(sourcePath, targetPath) {
  const tempPath = `${targetPath}.tmp.${Date.now()}`;
  fs.copyFileSync(sourcePath, tempPath);

  try {
    atomicReplace(tempPath, targetPath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}
```

### 测试要点

- 原子替换成功场景
- 目标文件不存在场景
- 失败时临时文件清理

---

## 第二部分：进程隔离

### 设计

每个 cs-cli 进程在独立的临时目录工作：

```javascript
// src/core/isolation.js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const SESSION_ID = crypto.randomBytes(8).toString('hex');
const SESSION_DIR = path.join(os.tmpdir(), `cs-cli-session-${SESSION_ID}`);

export function getSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
  return SESSION_DIR;
}

export function isolatedOperation(service, operation) {
  const sessionDir = getSessionDir();
  const workDir = path.join(sessionDir, service);

  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  return operation(workDir);
}

export function cleanupSession() {
  if (fs.existsSync(SESSION_DIR)) {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  }
}
```

### switcher.js 改造

```javascript
import { atomicSwitch } from './atomic.js';
import { isolatedOperation, cleanupSession } from './isolation.js';

export function switchConfig(service, variant, options = {}) {
  // ... 前置验证 ...

  try {
    return isolatedOperation(service, (workDir) => {
      const tempPath = path.join(workDir, adapter.getBaseName());
      fs.copyFileSync(sourcePath, tempPath);
      atomicSwitch(tempPath, targetPath);
      return { success: true, service, variant };
    });
  } finally {
    cleanupSession();
  }
}
```

---

## 第三部分：语义验证

### 设计

基础结构验证，检查 `api_key`（必需）和 `model`（可选）：

```javascript
// src/core/semantic-validator.js

export function validateClaudeSemantic(data) {
  const errors = [];

  if (!data.api_key && !data.providers?.length) {
    errors.push('Missing required field: api_key or providers');
  }

  if (data.model && typeof data.model !== 'string') {
    errors.push('Field "model" must be a string');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateGeminiSemantic(data) {
  const errors = [];

  if (!data.GEMINI_API_KEY && !data.API_KEY) {
    errors.push('Missing required field: GEMINI_API_KEY or API_KEY');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateCodexSemantic(data) {
  const errors = [];

  if (!data.env_key && !data.api_key) {
    errors.push('Missing required field: env_key or api_key');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateSemantic(service, data) {
  const validators = {
    claude: validateClaudeSemantic,
    gemini: validateGeminiSemantic,
    codex: validateCodexSemantic
  };

  const validator = validators[service];
  if (!validator) {
    return { valid: true, errors: [], warnings: [] };
  }

  return validator(data);
}
```

---

## 第四部分：init 命令

### 设计

交互式初始化向导：

```javascript
// src/commands/init.js
import inquirer from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'node:fs';

export async function initCommand(service = 'claude') {
  console.log(chalk.cyan(`\n🚀 Initializing ${service} configuration...\n`));

  const adapter = getAdapter(service);
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
      return;
    }
  }

  // 2. 检查现有配置
  const targetPath = adapter.getTargetPath();
  if (fs.existsSync(targetPath)) {
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

    if (action === 'cancel') return;
    if (action === 'variant') {
      await createVariant(adapter, targetPath);
      return;
    }
  }

  // 3. 创建示例配置
  await createExampleConfig(adapter, targetPath);
}
```

---

## 第五部分：交互式恢复

### 设计

使用选择器替代时间戳输入：

```javascript
// src/commands/restore.js
import inquirer from '@inquirer/prompts';
import chalk from 'chalk';

export async function restoreCommand(service, timestamp) {
  if (timestamp) {
    return restoreBackup(service, timestamp);
  }

  const backups = listBackups(service);

  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found'));
    return;
  }

  const { selected } = await inquirer.prompt({
    type: 'list',
    name: 'selected',
    message: `Select a ${service} backup to restore:`,
    choices: backups.map(b => ({
      name: formatBackupChoice(b),
      value: b.timestamp
    }))
  });

  return restoreBackup(service, selected);
}

function formatBackupChoice(backup) {
  const date = parseTimestamp(backup.timestamp);
  const relative = getRelativeTime(date);
  return `${backup.timestamp} (${relative})`;
}
```

---

## 第六部分：撤销/历史

### 设计

基于备份历史实现撤销：

```javascript
// src/core/history.js
import { listBackups, restoreBackup } from './backup.js';

export function undoSwitch(service = 'claude') {
  const backups = listBackups(service);

  if (backups.length < 2) {
    return {
      success: false,
      error: 'No previous backup found. Cannot undo.'
    };
  }

  const previousBackup = backups[1];
  return restoreBackup(service, previousBackup.timestamp);
}

export function getHistory(service = 'claude', limit = 10) {
  const backups = listBackups(service);

  return backups.slice(0, limit).map((backup, index) => ({
    timestamp: backup.timestamp,
    variant: index === 0 ? 'current' : `backup-${backup.timestamp.slice(-6)}`,
    isCurrent: index === 0
  }));
}
```

---

## 第七部分：Shell 补全

### 设计

动态补全工具名和配置变体名：

```javascript
// src/commands/completion.js
export function generateCompletionScript(shell) {
  const scripts = {
    bash: bashScript(),
    zsh: zshScript(),
    powershell: powershellScript(),
    fish: fishScript()
  };

  return scripts[shell] || scripts.bash;
}

export function getCompletions(current, words) {
  const cmd = words[words.length - 2] || '';

  // 补全主命令
  if (words.length <= 2) {
    return ['list', 'switch', 'current', 'diff', 'backup', 'restore', 'init', 'undo'];
  }

  // 补全 --service 参数
  if (cmd === '--service' || cmd === '-s') {
    return listServices().map(s => s.id);
  }

  // 补全 switch/diff 的变体名
  if (['switch', 'sw', 'diff'].includes(words[1])) {
    const service = getServiceFromArgs(words) || 'claude';
    const adapter = getAdapter(service);
    if (adapter) {
      return adapter.scanVariants().map(v => v.name);
    }
  }

  return [];
}
```

---

## 第八部分：配置预览

### 设计

切换前显示变更摘要：

```javascript
// src/core/preview.js
import chalk from 'chalk';

export function previewConfigChange(service, variant, adapter) {
  const sourcePath = adapter.getVariantPath(variant);
  const targetPath = adapter.getTargetPath();

  console.log(chalk.cyan(`\n📋 Preview: Switching ${service} to "${variant}"\n`));

  // 显示目标配置摘要
  const summary = getConfigSummary(service, sourcePath);
  console.log(chalk.yellow('Target configuration:'));
  console.log(formatSummary(summary));

  // 显示差异
  if (fs.existsSync(targetPath)) {
    console.log(chalk.yellow('\nChanges:'));
    const diffResult = diff(sourcePath, targetPath);
    if (diffResult.success) {
      console.log(formatDiff(diffResult.diff));
    }
  }
}

function getConfigSummary(service, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  switch (service) {
    case 'claude':
      const json = JSON.parse(content);
      return {
        provider: json.providers?.[0]?.name || 'Anthropic',
        model: json.model || 'default'
      };
    // ... 其他服务
  }
}
```

---

## 第九部分：审计日志

### 设计

记录所有切换操作：

```javascript
// src/utils/logger.js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const AUDIT_LOG_PATH = path.join(os.homedir(), '.cs-cli', 'audit.log');

export function logAudit(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    pid: process.pid,
    event
  };

  ensureAuditDir();
  const line = JSON.stringify(entry) + '\n';

  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch (error) {
    // 静默失败
  }
}

export function readAuditLog(options = {}) {
  if (!fs.existsSync(AUDIT_LOG_PATH)) {
    return [];
  }

  const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
  const entries = content.split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  let filtered = entries;

  if (options.service) {
    filtered = filtered.filter(e => e.event.service === options.service);
  }

  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

// 便捷函数
export function logSwitch(service, variant, success) {
  logAudit({
    action: 'switch',
    service,
    variant,
    success,
    cwd: process.cwd()
  });
}
```

---

## 第十部分：错误信息改进

### 设计

```javascript
// src/utils/error-formatter.js
import chalk from 'chalk';

export function formatVariantNotFoundError(service, variant, adapter) {
  const targetDir = adapter.getConfigDir();
  const expectedPath = adapter.getVariantPath(variant);

  return {
    title: chalk.red('Configuration variant not found'),
    details: [
      chalk.gray(`Service: ${service}`),
      chalk.gray(`Variant: ${variant}`),
      chalk.gray(`Expected path: ${expectedPath}`),
      '',
      chalk.yellow('Available variants:'),
      ...adapter.scanVariants().map(v => chalk.gray(`  - ${v.name}`))
    ],
    suggestions: [
      `Check the file exists at: ${expectedPath}`,
      `Ensure the directory exists: ${targetDir}`,
      `Available variants: ${adapter.scanVariants().map(v => v.name).join(', ')}`
    ]
  };
}
```

---

## 实施步骤

### 第一阶段：基础设施（高优先级）

| 步骤 | 任务 | 依赖 | 预估时间 |
|------|------|------|----------|
| 1 | 实现原子操作模块 (atomic.js) | 无 | 2h |
| 2 | 实现进程隔离模块 (isolation.js) | 无 | 3h |
| 3 | 实现语义验证模块 (semantic-validator.js) | 无 | 2h |
| 4 | 改造 switcher.js 使用新模块 | 1,2,3 | 2h |
| 5 | 编写原子操作和隔离测试 | 1,2,4 | 3h |

### 第二阶段：功能增强（中优先级）

| 步骤 | 任务 | 依赖 | 预估时间 |
|------|------|------|----------|
| 6 | 实现 init 命令 | 无 | 2h |
| 7 | 改进错误信息格式化 | 无 | 2h |
| 8 | 实现交互式恢复 | 无 | 1h |
| 9 | 实现历史/撤销模块 (history.js) | backup.js | 2h |
| 10 | 实现 undo 命令 | 9 | 1h |
| 11 | 编写功能测试 | 6,7,8,9,10 | 3h |

### 第三阶段：体验优化（低优先级）

| 步骤 | 任务 | 依赖 | 预估时间 |
|------|------|------|----------|
| 12 | 实现配置预览模块 (preview.js) | 无 | 2h |
| 13 | 实现 Shell 补全模块 (completion.js) | 无 | 3h |
| 14 | 实现审计日志模块 (logger.js) | 无 | 2h |
| 15 | 实现 audit 命令 | 14 | 1h |
| 16 | 整合所有命令到 CLI 入口 | 12,13,15 | 2h |
| 17 | 端到端测试 | 所有 | 3h |

**总计预估：约 40 小时**

---

## 依赖清单

现有依赖保持不变，无需新增。

---

## 文件变更清单

### 新增文件 (15个)

```
src/core/atomic.js
src/core/isolation.js
src/core/semantic-validator.js
src/core/history.js
src/core/preview.js
src/core/completion.js
src/commands/init.js
src/commands/undo.js
src/commands/completion.js
src/commands/audit.js
src/utils/error-formatter.js
src/utils/logger.js
tests/unit/atomic.test.js
tests/unit/isolation.test.js
tests/unit/semantic-validator.test.js
tests/unit/history.test.js
tests/integration/switch-flow.test.js
tests/integration/concurrent.test.js
tests/integration/error-recovery.test.js
```

### 修改文件 (6个)

```
src/core/switcher.js
src/core/validator.js
src/commands/restore.js
src/commands/switch.js
bin/cs-cli.js
README.md
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 进程隔离在 Windows 兼容性问题 | 高 | 充分测试 Windows 平台 |
| 原子操作在某些文件系统失败 | 中 | 降级到传统复制 |
| 临时文件清理不完整 | 中 | 进程退出时强制清理 |
| 语义验证规则过时 | 低 | 允许用户跳过验证 |

---

## 向后兼容性

- 所有现有命令保持兼容
- 新增参数都有默认值
- 旧版配置文件格式继续支持
- 备份文件格式不变
