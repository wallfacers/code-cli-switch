# Hook Installer 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 在 cs-cli 项目中提供跨平台的 ConfigChange hook 脚本，并在 npm install 和 cs-cli 切换时自动安装/更新 hook。

**架构:** 创建 `hooks/` 目录存放 hook 脚本，通过 `src/core/installer.js` 提供安装逻辑，在 switch 命令执行前检查并更新 hook。

**技术栈:** Node.js 原生 fs/path/os 模块，无额外依赖

---

## Task 1: 创建 Hook 脚本

**Files:**
- Create: `hooks/block-user-settings-change.js`

**Step 1: 创建跨平台 hook 脚本**

```js
#!/usr/bin/env node

/**
 * Cross-platform Claude ConfigChange blocker
 * Works on macOS / Linux / Windows
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// 读取 stdin
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", chunk => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      resolve(data);
    });
  });
}

(async () => {
  try {
    const inputRaw = await readStdin();
    const input = inputRaw ? JSON.parse(inputRaw) : {};

    const filePath = input.file_path || "unknown";

    // 构造日志目录
    const homeDir = os.homedir();
    const logDir = path.join(homeDir, ".claude", "logs");
    const logFile = path.join(logDir, "blocked-changes.log");

    // 确保目录存在
    fs.mkdirSync(logDir, { recursive: true });

    // 写入日志
    const logLine = `[${new Date().toISOString()}] Blocked settings change: ${filePath}${os.EOL}`;
    fs.appendFileSync(logFile, logLine);

  } catch (err) {
    // 即使出错也不能影响 hook 返回
  }

  // 返回 block 决策
  const response = {
    decision: "block",
    reason: "Settings changes are currently blocked for review"
  };

  process.stdout.write(JSON.stringify(response));
  process.exit(0);
})();
```

**Step 2: 提交**

```bash
git add hooks/block-user-settings-change.js
git commit -m "feat: add cross-platform ConfigChange hook script"
```

---

## Task 2: 创建安装器模块

**Files:**
- Create: `src/core/installer.js`
- Test: `tests/installer.test.js`

**Step 1: 创建 installer.js**

```js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取项目内 hook 源文件路径
 */
export function getHookSourcePath() {
  const projectRoot = path.resolve(__dirname, '../../');
  return path.join(projectRoot, 'hooks', 'block-user-settings-change.js');
}

/**
 * 获取目标安装路径
 * ~/.claude/hooks/block-user-settings-change.js
 */
export function getHookTargetPath() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, 'hooks', 'block-user-settings-change.js');
}

/**
 * 读取 hook 源文件内容
 */
export function getHookContent() {
  const sourcePath = getHookSourcePath();
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Hook source file not found: ${sourcePath}`);
  }
  return fs.readFileSync(sourcePath, 'utf8');
}

/**
 * 安装 hook（直接覆盖）
 */
export async function installHook() {
  const targetPath = getHookTargetPath();
  const content = getHookContent();

  // 确保目标目录存在
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 直接写入（覆盖）
  fs.writeFileSync(targetPath, content, 'utf8');

  return {
    success: true,
    path: targetPath
  };
}

/**
 * 检查并安装 hook
 */
export async function checkAndInstall() {
  const targetPath = getHookTargetPath();

  // 如果目标文件不存在，直接安装
  if (!fs.existsSync(targetPath)) {
    return installHook();
  }

  // 目标文件存在，对比内容后覆盖
  const sourceContent = getHookContent();
  const targetContent = fs.readFileSync(targetPath, 'utf8');

  if (sourceContent !== targetContent) {
    return installHook();
  }

  return {
    success: true,
    path: targetPath,
    updated: false,
    reason: 'content unchanged'
  };
}
```

**Step 2: 创建测试文件**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock fs
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn()
  };
});

// Mock os.homedir
vi.mock('node:os', () => ({
  homedir: () => '/mock/home'
}));

import fs from 'node:fs';
import { getHookSourcePath, getHookTargetPath, checkAndInstall } from '../../src/core/installer.js';

describe('installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct source path', () => {
    const sourcePath = getHookSourcePath();
    expect(sourcePath).toContain('hooks');
    expect(sourcePath).toContain('block-user-settings-change.js');
  });

  it('should return correct target path', () => {
    const targetPath = getHookTargetPath();
    expect(targetPath).toContain('.claude');
    expect(targetPath).toContain('hooks');
  });

  it('should install when target does not exist', async () => {
    fs.existsSync.mockReturnValueOnce(false);
    fs.readFileSync.mockReturnValueOnce('mock content');

    const result = await checkAndInstall();

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should update when content differs', async () => {
    fs.existsSync.mockReturnValueOnce(true);
    fs.readFileSync
      .mockReturnValueOnce('source content')  // source
      .mockReturnValueOnce('target content'); // target

    const result = await checkAndInstall();

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should skip when content same', async () => {
    fs.existsSync.mockReturnValueOnce(true);
    fs.readFileSync
      .mockReturnValueOnce('same content')
      .mockReturnValueOnce('same content');

    const result = await checkAndInstall();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
```

**Step 3: 运行测试验证**

```bash
npm run test:run tests/installer.test.js
```

预期: PASS

**Step 4: 提交**

```bash
git add src/core/installer.js tests/installer.test.js
git commit -m "feat: add installer module for hook installation"
```

---

## Task 3: 集成到 Switch 命令

**Files:**
- Modify: `src/core/switcher.js:1-30` - 添加 import
- Modify: `src/core/switcher.js:25-35` - 在 switchConfig 函数开头添加 hook 检查

**Step 1: 修改 switcher.js**

在文件顶部添加 import:
```js
import { checkAndInstall } from './installer.js';
```

在 switchConfig 函数开头（dryRun 检查之后）添加：
```js
// 0. 检查并安装 hook
const hookResult = await checkAndInstall();
if (!hookResult.success) {
  console.warn(`Warning: Failed to install hook: ${hookResult.error}`);
}
```

注意：由于 switchConfig 不是 async 函数，需要改为 async 或者在调用处处理。

**Step 2: 修改 src/commands/switch.js**

在 switchCommand 函数开头添加 hook 检查（不需要等待结果，不阻塞切换）：
```js
// 检查并安装 hook（不阻塞切换）
checkAndInstall().catch(err => {
  console.warn(`Warning: Failed to install hook: ${err.message}`);
});
```

**Step 3: 提交**

```bash
git add src/core/switcher.js src/commands/switch.js
git commit -m "feat: integrate hook installation in switch command"
```

---

## Task 4: 添加 npm postinstall 脚本

**Files:**
- Modify: `package.json:9-12` - 添加 postinstall 脚本

**Step 1: 修改 package.json**

添加 postinstall 脚本：
```json
"scripts": {
  "test": "vitest",
  "test:run": "vitest run",
  "lint": "eslint src/",
  "postinstall": "node -e \"import('./src/core/installer.js').then(m => m.checkAndInstall().then(r => { if(r.success) console.log('Hook installed:', r.path); }))\""
}
```

**Step 2: 本地测试安装**

```bash
npm install
```

预期输出包含 "Hook installed: ..."

**Step 3: 提交**

```bash
git add package.json
git commit -m "feat: add postinstall script for automatic hook installation"
```

---

## Task 5: 添加 install-hook 命令（可选）

**Files:**
- Create: `src/commands/install-hook.js`

**Step 1: 创建命令文件**

```js
import chalk from 'chalk';
import { installHook } from '../core/installer.js';

/**
 * install-hook 命令 - 手动安装 hook
 */
export async function installHookCommand() {
  try {
    const result = await installHook();

    if (result.success) {
      console.log(chalk.green('✓ Hook installed:'), result.path);
      return 0;
    } else {
      console.error(chalk.red('✗ Failed to install hook:'), result.error);
      return 1;
    }
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error.message);
    return 1;
  }
}
```

**Step 2: 在 bin/cs-cli.js 中注册命令**

添加：
```js
import { installHookCommand } from '../src/commands/install-hook.js';

program
  .command('install-hook')
  .description('Install ConfigChange hook')
  .action(installHookCommand);
```

**Step 3: 提交**

```bash
git add src/commands/install-hook.js bin/cs-cli.js
git commit -m "feat: add install-hook command for manual hook installation"
```

---

## 总结

完成所有任务后，项目具备以下功能：
1. 跨平台 ConfigChange hook 脚本
2. `npm install` 时自动安装 hook
3. `cs-cli switch` 时检查并更新 hook
4. `cs-cli install-hook` 手动安装命令
