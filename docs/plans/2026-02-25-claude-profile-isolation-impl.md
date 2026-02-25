# Claude Profile 隔离切换实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现配置文件隔离切换，通过独立配置目录和 CLAUDE_CONFIG_DIR 环境变量，使切换仅影响当前终端会话，不影响其他已运行的 Claude Code 窗口。

**Architecture:** 采用独立配置目录方案（~/.claude/profiles/{variant}/），切换时设置 CLAUDE_CONFIG_DIR 环境变量，新启动的 Claude Code 读取对应目录的配置。

**Tech Stack:** Node.js, ES Modules, chalk (输出格式化)

---
## 目录结构变化

```
# 现有结构
~/.claude/
├── settings.json
├── settings.json.work
└── settings.json.personal

# 目标结构
~/.claude/
├── settings.json              # 全局默认（回退用）
├── profiles/
│   ├── default/
│   │   └── settings.json
│   ├── work/
│   │   └── settings.json
│   └── personal/
│       └── settings.json
└── .cs-state.json
```

---

### Task 1: 修改 ClaudeAdapter 添加 profiles 目录支持

**Files:**
- Modify: `src/core/services/claude.js`

**Step 1: 添加 profiles 目录相关方法**

在 ClaudeAdapter 类中添加以下方法：

```javascript
/**
 * 获取 profiles 目录路径
 * @returns {string}
 */
getProfilesDir() {
  return path.join(this.getConfigDir(), 'profiles');
}

/**
 * 获取指定 profile 的配置目录
 * @param {string} variant - profile 名称
 * @returns {string}
 */
getProfileDir(variant) {
  return path.join(this.getProfilesDir(), variant);
}

/**
 * 获取指定 profile 的 settings.json 路径
 * @param {string} variant - profile 名称
 * @returns {string}
 */
getProfilePath(variant) {
  return path.join(this.getProfileDir(variant), 'settings.json');
}

/**
 * 检查 profiles 目录是否已初始化
 * @returns {boolean}
 */
profilesInitialized() {
  const profilesDir = this.getProfilesDir();
  return fs.existsSync(profilesDir) && fs.statSync(profilesDir).isDirectory();
}

/**
 * 迁移现有配置到 profiles 目录
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async migrateToProfiles() {
  const profilesDir = this.getProfilesDir();
  const defaultDir = this.getProfileDir('default');

  // 创建 profiles 和 default 目录
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  // 复制现有 settings.json 到 default
  const currentSettings = this.getTargetPath();
  const defaultSettings = this.getProfilePath('default');

  if (fs.existsSync(currentSettings)) {
    fs.copyFileSync(currentSettings, defaultSettings);
  }

  return { success: true };
}
```

**Step 2: 修改 getVariantPath 支持 profiles**

将现有的 `getVariantPath` 方法改为优先从 profiles 目录读取：

```javascript
getVariantPath(variant) {
  // 优先从 profiles 目录读取
  const profilePath = this.getProfilePath(variant);
  if (fs.existsSync(profilePath)) {
    return profilePath;
  }
  // 回退到旧的格式
  return path.join(this.getConfigDir(), `settings.json.${variant}`);
}
```

**Step 3: Commit**

```bash
git add src/core/services/claude.js
git commit -m "feat: add profiles directory support to ClaudeAdapter"
```

---

### Task 2: 修改 switcher.js 支持 profiles 切换

**Files:**
- Modify: `src/core/switcher.js`

**Step 1: 添加 profiles 初始化检查**

在 `switchConfig` 函数开头添加：

```javascript
// 检查并初始化 profiles 目录
if (!adapter.profilesInitialized()) {
  const migrateResult = await adapter.migrateToProfiles();
  if (!migrateResult.success) {
    return {
      success: false,
      error: `Failed to initialize profiles: ${migrateResult.error}`
    };
  }
}
```

**Step 2: 修改返回值添加环境变量信息**

在成功返回时添加：

```javascript
return {
  success: true,
  service,
  variant,
  backup: backupResult?.timestamp || null,
  configDir: adapter.getProfilePath(variant),
  message: `Switched ${service} to "${variant}"`
};
```

**Step 3: Commit**

```bash
git add src/core/switcher.js
git commit -m "feat: support profiles switching in switcher"
```

---

### Task 3: 修改 switch 命令输出环境变量指导

**Files:**
- Modify: `src/commands/switch.js`

**Step 1: 修改 switchCommand 添加环境变量输出**

在成功输出后添加：

```javascript
if (result.configDir) {
  const configDir = result.configDir;
  console.log(chalk.gray(`\nTo activate in current shell, run:`));
  console.log(chalk.cyan(`  export CLAUDE_CONFIG_DIR="${configDir}"`));
  console.log(chalk.gray(`\nTo make it permanent, add to your shell config:`));
  console.log(chalk.cyan(`  echo 'export CLAUDE_CONFIG_DIR="${configDir}"' >> ~/.zshrc`));
}
```

**Step 2: Commit**

```bash
git add src/commands/switch.js
git commit -m "feat: display CLAUDE_CONFIG_DIR export instructions"
```

---

### Task 4: 添加 profiles 列表命令

**Files:**
- Create: `src/commands/profiles.js`

**Step 1: 创建 profiles 命令**

```javascript
import chalk from 'chalk';
import { getAdapter } from '../core/registry.js';
import { t } from '../utils/i18n.js';

/**
 * profiles 命令 - 管理配置 profiles
 * @param {string} action - list/current/create/delete
 * @param {string} name - profile 名称
 * @param {object} options - 选项
 */
export async function profilesCommand(action, name, options = {}) {
  const adapter = getAdapter('claude');
  if (!adapter) {
    console.error(chalk.red('Claude adapter not found'));
    return 1;
  }

  switch (action) {
    case 'list':
      return listProfiles(adapter);
    case 'current':
      return showCurrent(adapter);
    case 'create':
      return createProfile(adapter, name, options);
    case 'delete':
      return deleteProfile(adapter, name);
    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      console.log(chalk.yellow('Usage: cs-cli profiles [list|current|create|delete]'));
      return 1;
  }
}

function listProfiles(adapter) {
  const profilesDir = adapter.getProfilesDir();

  if (!fs.existsSync(profilesDir)) {
    console.log(chalk.yellow('No profiles found. Run "cs-cli switch" to create one.'));
    return 0;
  }

  const dirs = fs.readdirSync(profilesDir).filter(d => {
    return fs.statSync(path.join(profilesDir, d)).isDirectory();
  });

  if (dirs.length === 0) {
    console.log(chalk.yellow('No profiles found.'));
    return 0;
  }

  const currentConfigDir = process.env.CLAUDE_CONFIG_DIR || adapter.getConfigDir();

  console.log(chalk.bold('Available profiles:\n'));
  for (const dir of dirs) {
    const profilePath = adapter.getProfilePath(dir);
    const isActive = currentConfigDir && profilePath.includes(currentConfigDir);
    const marker = isActive ? chalk.green('* ') : '  ';
    console.log(`${marker}${dir}`);
  }

  return 0;
}

function showCurrent(adapter) {
  const configDir = process.env.CLAUDE_CONFIG_DIR || adapter.getConfigDir();
  console.log(chalk.bold('Current profile:'));
  console.log(chalk.cyan(configDir));
  return 0;
}

function createProfile(adapter, name, options) {
  if (!name) {
    console.error(chalk.red('Profile name required'));
    return 1;
  }

  const profileDir = adapter.getProfileDir(name);

  if (fs.existsSync(profileDir)) {
    console.error(chalk.red(`Profile "${name}" already exists`));
    return 1;
  }

  fs.mkdirSync(profileDir, { recursive: true });

  // 如果指定了 --from，从已有配置复制
  if (options.from) {
    const sourcePath = adapter.getProfilePath(options.from);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, adapter.getProfilePath(name));
      console.log(chalk.green(`✓ Created profile "${name}" from "${options.from}"`));
    } else {
      console.warn(chalk.yellow(`Source profile "${options.from}" not found, created empty profile`));
    }
  } else {
    // 创建空的 settings.json
    fs.writeFileSync(adapter.getProfilePath(name), JSON.stringify({}, null, 2));
    console.log(chalk.green(`✓ Created empty profile "${name}"`));
  }

  return 0;
}

function deleteProfile(adapter, name) {
  if (!name) {
    console.error(chalk.red('Profile name required'));
    return 1;
  }

  const profileDir = adapter.getProfileDir(name);

  if (!fs.existsSync(profileDir)) {
    console.error(chalk.red(`Profile "${name}" not found`));
    return 1;
  }

  fs.rmSync(profileDir, { recursive: true });
  console.log(chalk.green(`✓ Deleted profile "${name}"`));

  return 0;
}
```

**Step 2: 添加导出**

在文件末尾添加：
```javascript
import fs from 'node:fs';
import path from 'node:path';
```

**Step 3: 在主入口注册命令**

需要修改主入口文件添加 profiles 命令注册。

**Step 4: Commit**

```bash
git add src/commands/profiles.js
git commit -m "feat: add profiles command for profile management"
```

---

### Task 5: 更新 list 命令支持 profiles 显示

**Files:**
- Modify: `src/commands/list.js`

**Step 1: 修改 list 命令**

在显示变体列表时，检查 profiles 目录：

```javascript
// 在 scanVariants 结果后添加
if (adapter.profilesInitialized) {
  const profiles = fs.readdirSync(adapter.getProfilesDir())
    .filter(d => fs.statSync(path.join(adapter.getProfilesDir(), d)).isDirectory());
  console.log(chalk.gray('\nProfiles:'));
  for (const p of profiles) {
    console.log(`  - ${p}`);
  }
}
```

**Step 2: Commit**

```bash
git add src/commands/list.js
git commit -m "feat: show profiles in list command"
```

---

### Task 6: 添加单元测试

**Files:**
- Create: `tests/profiles.test.js`

**Step 1: 编写测试**

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ClaudeAdapter } from '../src/core/services/claude.js';

describe('ClaudeAdapter profiles', () => {
  let adapter;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-test-'));
    // Mock getConfigDir to return temp dir
    adapter = new ClaudeAdapter();
    adapter.getConfigDir = () => tempDir;
  });

  it('should create profiles directory', () => {
    adapter.migrateToProfiles();
    expect(fs.existsSync(adapter.getProfilesDir())).toBe(true);
    expect(fs.existsSync(adapter.getProfileDir('default'))).toBe(true);
  });

  it('should get profile path correctly', () => {
    const profilePath = adapter.getProfilePath('work');
    expect(profilePath).toBe(path.join(tempDir, 'profiles', 'work', 'settings.json'));
  });

  it('should check profiles initialized', () => {
    expect(adapter.profilesInitialized()).toBe(false);
    adapter.migrateToProfiles();
    expect(adapter.profilesInitialized()).toBe(true);
  });
});
```

**Step 2: 运行测试**

```bash
npm test tests/profiles.test.js
```

**Step 3: Commit**

```bash
git add tests/profiles.test.js
git commit -m "test: add profiles unit tests"
```

---

### Task 7: 集成测试（手动）

**Step 1: 本地测试**

```bash
# 1. 首次切换（触发迁移）
cs-cli switch work

# 2. 检查目录结构
ls -la ~/.claude/profiles/

# 3. 测试 profiles list
cs-cli profiles list

# 4. 测试创建新 profile
cs-cli profiles create test-profile --from work

# 5. 验证环境变量生效
export CLAUDE_CONFIG_DIR=~/.claude/profiles/work
cs-cli current
```

**Step 2: Commit**

```bash
git add . && git commit -m "test: manual integration testing"
```

---

## 总结

实现分为 7 个任务：
1. 修改 ClaudeAdapter 添加 profiles 支持
2. 修改 switcher 支持 profiles 切换
3. 修改 switch 命令输出环境变量指导
4. 添加 profiles 管理命令
5. 更新 list 命令
6. 添加单元测试
7. 手动集成测试

**Plan complete and saved to `docs/plans/2026-02-25-claude-profile-isolation-impl.md`. Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing_plans, batch execution with checkpoints

**Which approach?**
