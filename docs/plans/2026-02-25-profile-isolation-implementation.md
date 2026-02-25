# Profile Isolation 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Claude Code 配置隔离，切换配置后仅当前终端会话生效，不影响其他窗口

**Architecture:** 使用 `CLAUDE_CONFIG_DIR` 环境变量 + `profiles/` 目录实现隔离。切换时输出 `export` 命令供 `eval` 执行，并自动持久化到 shell 配置文件。

**Tech Stack:** Node.js, ES Modules, Vitest

---

## Task 1: 创建 Shell 配置持久化模块

**Files:**
- Create: `src/core/shell-config.js`
- Test: `tests/unit/shell-config.test.js`

**Step 1: Write the failing test**

```javascript
// tests/unit/shell-config.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectShell,
  getShellConfigPath,
  updateShellConfig,
  generateExportCommand
} from '../../src/core/shell-config.js';

describe('shell-config', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectShell', () => {
    it('should detect zsh from SHELL env', () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/bin/zsh';
      expect(detectShell()).toBe('zsh');
      process.env.SHELL = originalShell;
    });

    it('should detect bash from SHELL env', () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/bin/bash';
      expect(detectShell()).toBe('bash');
      process.env.SHELL = originalShell;
    });

    it('should detect powershell from PSHOME env', () => {
      const originalPsHome = process.env.PSHOME;
      process.env.PSHOME = '/usr/local/microsoft/powershell';
      expect(detectShell()).toBe('powershell');
      process.env.PSHOME = originalPsHome;
    });

    it('should fallback to bash on unix when SHELL not set', () => {
      const originalShell = process.env.SHELL;
      const originalPlatform = process.platform;
      delete process.env.SHELL;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(detectShell()).toBe('bash');
      process.env.SHELL = originalShell;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('getShellConfigPath', () => {
    it('should return .zshrc for zsh', () => {
      const configPath = getShellConfigPath('zsh');
      expect(configPath).toContain('.zshrc');
    });

    it('should return .bashrc for bash', () => {
      const configPath = getShellConfigPath('bash');
      expect(configPath).toContain('.bashrc');
    });

    it('should return $PROFILE for powershell', () => {
      const configPath = getShellConfigPath('powershell');
      expect(configPath).toContain('Microsoft.PowerShell_profile.ps1');
    });
  });

  describe('generateExportCommand', () => {
    it('should generate export for unix shells', () => {
      const cmd = generateExportCommand('/home/user/.claude/profiles/glm', 'bash');
      expect(cmd).toBe('export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/glm"');
    });

    it('should generate $env for powershell', () => {
      const cmd = generateExportCommand('C:\\Users\\test\\.claude\\profiles\\glm', 'powershell');
      expect(cmd).toBe('$env:CLAUDE_CONFIG_DIR = "C:\\Users\\test\\.claude\\profiles\\glm"');
    });
  });

  describe('updateShellConfig', () => {
    it('should add new config block if not exists', () => {
      const configPath = path.join(tempDir, '.zshrc');
      fs.writeFileSync(configPath, '# existing content\n');

      updateShellConfig(configPath, '/home/user/.claude/profiles/glm', 'bash');

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('# cs-cli-auto-start');
      expect(content).toContain('export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/glm"');
      expect(content).toContain('# cs-cli-auto-end');
    });

    it('should update existing config block', () => {
      const configPath = path.join(tempDir, '.zshrc');
      fs.writeFileSync(configPath, `# existing
# cs-cli-auto-start
export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/old"
# cs-cli-auto-end
# more content`);

      updateShellConfig(configPath, '/home/user/.claude/profiles/glm', 'bash');

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('export CLAUDE_CONFIG_DIR="/home/user/.claude/profiles/glm"');
      expect(content).not.toContain('profiles/old');
      expect(content).toContain('# more content');
    });

    it('should handle powershell format', () => {
      const configPath = path.join(tempDir, 'Microsoft.PowerShell_profile.ps1');
      fs.writeFileSync(configPath, '# existing content\n');

      updateShellConfig(configPath, 'C:\\Users\\test\\.claude\\profiles\\glm', 'powershell');

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('# cs-cli-auto-start');
      expect(content).toContain('$env:CLAUDE_CONFIG_DIR = "C:\\Users\\test\\.claude\\profiles\\glm"');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/shell-config.test.js --run`
Expected: FAIL with "module not found"

**Step 3: Write minimal implementation**

```javascript
// src/core/shell-config.js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MARKER_START = '# cs-cli-auto-start';
const MARKER_END = '# cs-cli-auto-end';

/**
 * 检测当前 shell 类型
 * @returns {'zsh'|'bash'|'powershell'|'cmd'}
 */
export function detectShell() {
  // 检测 PowerShell
  if (process.env.PSHOME || isPowerShellEnv()) {
    return 'powershell';
  }

  // 检测 CMD
  if (process.platform === 'win32' && process.env.COMSPEC?.includes('cmd.exe')) {
    return 'cmd';
  }

  // Unix shell 检测
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) {
    return 'zsh';
  }
  if (shell.includes('bash')) {
    return 'bash';
  }

  // 默认
  return process.platform === 'win32' ? 'powershell' : 'bash';
}

/**
 * 检测是否在 PowerShell 环境中
 */
function isPowerShellEnv() {
  // 检查常见的 PowerShell 环境变量或路径特征
  const cwd = process.cwd();
  return cwd.includes('PowerShell') || process.env.term?.includes('pwsh');
}

/**
 * 获取 shell 配置文件路径
 * @param {string} shellType - shell 类型
 * @returns {string}
 */
export function getShellConfigPath(shellType) {
  const home = os.homedir();

  switch (shellType) {
    case 'zsh':
      return path.join(home, '.zshrc');
    case 'bash':
      return path.join(home, '.bashrc');
    case 'powershell':
      // PowerShell $PROFILE 路径
      if (process.platform === 'win32') {
        return path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
      }
      return path.join(home, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
    default:
      return path.join(home, '.bashrc');
  }
}

/**
 * 生成环境变量导出命令
 * @param {string} configDir - 配置目录路径
 * @param {string} shellType - shell 类型
 * @returns {string}
 */
export function generateExportCommand(configDir, shellType) {
  // 统一使用正斜杠
  const normalizedPath = configDir.replace(/\\/g, '/');

  switch (shellType) {
    case 'powershell':
      return `$env:CLAUDE_CONFIG_DIR = "${normalizedPath}"`;
    case 'cmd':
      return `set CLAUDE_CONFIG_DIR=${normalizedPath}`;
    default:
      return `export CLAUDE_CONFIG_DIR="${normalizedPath}"`;
  }
}

/**
 * 更新 shell 配置文件
 * @param {string} configPath - 配置文件路径
 * @param {string} configDir - CLAUDE_CONFIG_DIR 值
 * @param {string} shellType - shell 类型
 * @returns {{success: boolean, error?: string}}
 */
export function updateShellConfig(configPath, configDir, shellType) {
  try {
    const exportCmd = generateExportCommand(configDir, shellType);
    const configBlock = `${MARKER_START}\n${exportCmd}\n${MARKER_END}`;

    // 确保目录存在
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 如果文件不存在，创建新文件
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, configBlock + '\n');
      return { success: true };
    }

    // 读取现有内容
    let content = fs.readFileSync(configPath, 'utf-8');

    // 检查是否存在标记区间
    const startIndex = content.indexOf(MARKER_START);
    const endIndex = content.indexOf(MARKER_END);

    if (startIndex !== -1 && endIndex !== -1) {
      // 替换现有区间
      content = content.slice(0, startIndex) + configBlock + content.slice(endIndex + MARKER_END.length);
    } else {
      // 追加到末尾
      if (!content.endsWith('\n')) {
        content += '\n';
      }
      content += '\n' + configBlock + '\n';
    }

    fs.writeFileSync(configPath, content);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/shell-config.test.js --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/shell-config.js tests/unit/shell-config.test.js
git commit -m "feat: add shell config persistence module"
```

---

## Task 2: 扩展 ClaudeAdapter 支持 profiles

**Files:**
- Modify: `src/core/services/claude.js`
- Modify: `tests/scan.test.js`

**Step 1: Write the failing test**

在 `tests/scan.test.js` 中添加测试：

```javascript
// 添加到 tests/scan.test.js

describe('ClaudeAdapter profiles support', () => {
  let tempDir;
  let originalHome;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-profiles-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should get profiles directory', () => {
    const adapter = new ClaudeAdapter();
    const profilesDir = adapter.getProfilesDir();
    expect(profilesDir).toContain('profiles');
  });

  it('should get profile path', () => {
    const adapter = new ClaudeAdapter();
    const profilePath = adapter.getProfilePath('glm');
    expect(profilePath).toContain('profiles');
    expect(profilePath).toContain('glm');
    expect(profilePath).toContain('settings.json');
  });

  it('should check if profiles initialized', () => {
    const adapter = new ClaudeAdapter();
    expect(adapter.profilesInitialized()).toBe(false);

    fs.mkdirSync(adapter.getProfilesDir(), { recursive: true });
    expect(adapter.profilesInitialized()).toBe(true);
  });

  it('should migrate legacy variant to profiles', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    // 创建 legacy 文件
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'settings.json.glm'),
      JSON.stringify({ test: true })
    );

    const result = adapter.migrateVariantToProfile('glm');

    expect(result.success).toBe(true);
    expect(fs.existsSync(adapter.getProfilePath('glm'))).toBe(true);
    // legacy 文件仍存在
    expect(fs.existsSync(path.join(configDir, 'settings.json.glm'))).toBe(true);
  });

  it('should return profile path when it exists', () => {
    const adapter = new ClaudeAdapter();

    // 创建 profile
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), '{}');

    const variantPath = adapter.getVariantPath('glm');
    expect(variantPath).toContain('profiles');
    expect(variantPath).toContain('glm');
  });

  it('should fallback to legacy path when profile not exists but legacy exists', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    // 只创建 legacy 文件
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'settings.json.claude'),
      JSON.stringify({ test: true })
    );

    const variantPath = adapter.getVariantPath('claude');
    expect(variantPath).toContain('settings.json.claude');
    expect(variantPath).not.toContain('profiles');
  });

  it('should scan both profiles and legacy variants', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    // 创建 profile
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), '{}');

    // 创建 legacy variant
    fs.writeFileSync(
      path.join(configDir, 'settings.json.work'),
      JSON.stringify({})
    );

    const variants = adapter.scanVariants();
    const names = variants.map(v => v.name);

    expect(names).toContain('glm');
    expect(names).toContain('work');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/scan.test.js --run`
Expected: FAIL with "is not a function"

**Step 3: Write minimal implementation**

修改 `src/core/services/claude.js`：

```javascript
// 在现有方法后添加以下方法到 ClaudeAdapter 类中

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
  try {
    const profilesDir = this.getProfilesDir();
    return fs.existsSync(profilesDir) && fs.statSync(profilesDir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 迁移 legacy 变体到 profiles 目录
 * @param {string} variant - 变体名称
 * @returns {{success: boolean, error?: string, migrated?: boolean}}
 */
migrateVariantToProfile(variant) {
  try {
    const legacyPath = path.join(this.getConfigDir(), `settings.json.${variant}`);
    const profilePath = this.getProfilePath(variant);

    // 如果 profile 已存在，不需要迁移
    if (fs.existsSync(profilePath)) {
      return { success: true, migrated: false };
    }

    // 如果 legacy 不存在，无法迁移
    if (!fs.existsSync(legacyPath)) {
      return { success: false, error: `Legacy variant "${variant}" not found` };
    }

    // 创建 profile 目录并复制
    fs.mkdirSync(this.getProfileDir(variant), { recursive: true });
    fs.copyFileSync(legacyPath, profilePath);

    return { success: true, migrated: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 获取候选配置文件路径（重写）
 * 优先从 profiles 目录读取，回退到旧的格式
 * @param {string} variant - 配置变体名称
 * @returns {string}
 */
getVariantPath(variant) {
  // 优先从 profiles 目录读取
  const profilePath = this.getProfilePath(variant);
  if (fs.existsSync(profilePath)) {
    return profilePath;
  }
  // 回退到旧的格式
  return path.join(this.getConfigDir(), `settings.json.${variant}`);
}

/**
 * 扫描所有配置变体（重写）
 * 同时扫描 profiles 目录和 legacy 文件
 * @returns {Array<{name: string, path: string, active: boolean}>}
 */
scanVariants() {
  const configDir = this.getConfigDir();
  const profilesDir = this.getProfilesDir();
  const targetPath = this.getTargetPath();
  const variants = new Map();
  const state = this.readState();

  // 获取当前生效配置的哈希
  const currentHash = fs.existsSync(targetPath) ? fileHash(targetPath) : null;

  // 扫描 profiles 目录
  if (fs.existsSync(profilesDir)) {
    const dirs = fs.readdirSync(profilesDir);
    for (const dir of dirs) {
      const profilePath = path.join(profilesDir, dir, 'settings.json');
      if (fs.existsSync(profilePath)) {
        let active = false;
        if (currentHash) {
          const variantHash = fileHash(profilePath);
          active = variantHash === currentHash;
        }
        variants.set(dir, {
          name: dir,
          path: profilePath,
          active,
          current: state.current === dir
        });
      }
    }
  }

  // 扫描 legacy 文件
  if (fs.existsSync(configDir)) {
    const files = fs.readdirSync(configDir);
    for (const file of files) {
      const variant = this.extractVariantName(file);
      if (variant && !variants.has(variant)) {
        const filePath = path.join(configDir, file);
        let active = false;
        if (currentHash) {
          const variantHash = fileHash(filePath);
          active = variantHash === currentHash;
        }
        variants.set(variant, {
          name: variant,
          path: filePath,
          active,
          current: state.current === variant
        });
      }
    }
  }

  // 转换为数组并排序
  const result = Array.from(variants.values());

  // 检查状态文件记录的变体是否还存在
  if (state.current && !result.some(v => v.name === state.current)) {
    this.clearState();
  }

  return result.sort((a, b) => {
    if (a.active) return -1;
    if (a.current) return -1;
    if (b.active) return 1;
    if (b.current) return 1;
    return a.name.localeCompare(b.name);
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/scan.test.js --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/services/claude.js tests/scan.test.js
git commit -m "feat: extend ClaudeAdapter with profiles support"
```

---

## Task 3: 修改 switcher.js 使用 profiles 隔离

**Files:**
- Modify: `src/core/switcher.js`
- Modify: `tests/integration/switch-flow.test.js`

**Step 1: Write the failing test**

在 `tests/integration/switch-flow.test.js` 中添加测试：

```javascript
// 添加到 tests/integration/switch-flow.test.js

import { switchConfig } from '../../src/core/switcher.js';

describe('switch with profile isolation', () => {
  let tempDir;
  let originalHome;
  let originalConfigDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-isolation-test-'));
    originalHome = process.env.HOME;
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = tempDir;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (originalConfigDir) {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return export command on success', () => {
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), JSON.stringify({ vendor: 'glm' }));

    const result = switchConfig('claude', 'glm');

    expect(result.success).toBe(true);
    expect(result.exportCommand).toBeDefined();
    expect(result.exportCommand).toContain('CLAUDE_CONFIG_DIR');
    expect(result.exportCommand).toContain('profiles/glm');
  });

  it('should not modify global settings.json', () => {
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), JSON.stringify({ vendor: 'glm' }));

    // 创建全局配置
    fs.writeFileSync(adapter.getTargetPath(), JSON.stringify({ vendor: 'claude' }));
    const originalContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');

    switchConfig('claude', 'glm');

    // 全局配置应该不变
    const currentContent = fs.readFileSync(adapter.getTargetPath(), 'utf-8');
    expect(currentContent).toBe(originalContent);
  });

  it('should auto-migrate legacy variant to profile', () => {
    const adapter = new ClaudeAdapter();
    const configDir = adapter.getConfigDir();

    // 只创建 legacy 文件
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'settings.json.glm'),
      JSON.stringify({ vendor: 'glm' })
    );

    const result = switchConfig('claude', 'glm');

    expect(result.success).toBe(true);
    expect(fs.existsSync(adapter.getProfilePath('glm'))).toBe(true);
  });

  it('should inject statusLine to profile settings', () => {
    const adapter = new ClaudeAdapter();
    fs.mkdirSync(adapter.getProfileDir('glm'), { recursive: true });
    fs.writeFileSync(adapter.getProfilePath('glm'), JSON.stringify({}));

    switchConfig('claude', 'glm');

    const profileContent = JSON.parse(fs.readFileSync(adapter.getProfilePath('glm'), 'utf-8'));
    expect(profileContent.statusLine).toBeDefined();
    expect(profileContent.statusLine.command).toContain('glm');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/switch-flow.test.js --run`
Expected: FAIL

**Step 3: Write minimal implementation**

修改 `src/core/switcher.js`：

```javascript
// 完整重写 switcher.js
import fs from 'node:fs';
import { getAdapter } from './registry.js';
import { fileHash } from '../utils/hash.js';
import { injectStatusLine } from './statusline.js';
import { detectShell, getShellConfigPath, updateShellConfig, generateExportCommand } from './shell-config.js';

/**
 * 切换到指定配置（使用 profile 隔离）
 * @param {string} service - 服务标识 (claude/gemini/codex)，默认为 claude
 * @param {string} variant - 配置变体名称
 * @param {object} options - { dryRun: boolean, noPersist: boolean }
 * @returns {object}
 */
export function switchConfig(service, variant, options = {}) {
  // 兼容旧接口
  if (typeof variant === 'object') {
    options = variant;
    variant = service;
    service = 'claude';
  }

  const { dryRun = false, noPersist = false } = options;

  const adapter = getAdapter(service);
  if (!adapter) {
    return {
      success: false,
      error: `Unknown coding tool: "${service}"`,
      suggestions: listAvailableServices()
    };
  }

  // 对于 Claude 服务，使用 profile 隔离
  if (service === 'claude') {
    return switchWithProfile(adapter, variant, { dryRun, noPersist });
  }

  // 其他服务保持原有逻辑
  return switchLegacy(adapter, variant, { dryRun });
}

/**
 * 使用 profile 隔离切换（仅 Claude）
 */
function switchWithProfile(adapter, variant, options) {
  const { dryRun, noPersist } = options;

  // 1. 检查 profile 是否存在，不存在则尝试迁移
  const profilePath = adapter.getProfilePath(variant);
  const legacyPath = adapter.getLegacyPath ? adapter.getLegacyPath(variant) : null;

  if (!fs.existsSync(profilePath)) {
    // 尝试从 legacy 迁移
    if (legacyPath && fs.existsSync(legacyPath)) {
      const migrateResult = adapter.migrateVariantToProfile(variant);
      if (!migrateResult.success) {
        return {
          success: false,
          error: `Failed to migrate variant: ${migrateResult.error}`,
          suggestions: listAvailableVariants(adapter)
        };
      }
    } else {
      return {
        success: false,
        error: `Configuration variant "${variant}" not found`,
        suggestions: listAvailableVariants(adapter)
      };
    }
  }

  // 2. 格式校验
  const validation = adapter.validate(profilePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';
    return {
      success: false,
      error: `Invalid format in profile "${variant}": ${errorMsg}`
    };
  }

  // Dry-run 模式
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      service: 'claude',
      message: `Would switch claude to "${variant}"`,
      source: profilePath,
      profileDir: adapter.getProfileDir(variant)
    };
  }

  try {
    // 3. 注入 statusLine 配置到 profile
    const injectResult = injectStatusLine(profilePath, variant);
    if (!injectResult.success) {
      console.warn(`Warning: Failed to inject statusLine: ${injectResult.error}`);
    }

    // 4. 更新状态
    const hash = fileHash(profilePath);
    adapter.writeState(variant, hash);

    // 5. 获取 profile 目录路径
    const profileDir = adapter.getProfileDir(variant);

    // 6. 持久化到 shell 配置
    const shellType = detectShell();
    const shellConfigPath = getShellConfigPath(shellType);
    const persistResult = updateShellConfig(shellConfigPath, profileDir, shellType);

    if (!persistResult.success) {
      console.warn(`Warning: Failed to update shell config: ${persistResult.error}`);
    }

    // 7. 生成 export 命令
    const exportCommand = generateExportCommand(profileDir, shellType);

    return {
      success: true,
      service: 'claude',
      variant,
      profileDir,
      exportCommand,
      shellType,
      shellConfigPath: persistResult.success ? shellConfigPath : null,
      message: `Switched claude to "${variant}"`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to switch: ${error.message}`
    };
  }
}

/**
 * 传统切换方式（非 Claude 服务）
 */
function switchLegacy(adapter, variant, options) {
  const { dryRun } = options;

  const sourcePath = adapter.getVariantPath(variant);
  const targetPath = adapter.getTargetPath();

  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      error: `Configuration variant "${variant}" not found`,
      suggestions: listAvailableVariants(adapter)
    };
  }

  const validation = adapter.validate(sourcePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';
    return {
      success: false,
      error: `Invalid format: ${errorMsg}`
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `Would switch to "${variant}"`,
      source: sourcePath,
      target: targetPath
    };
  }

  try {
    // 原子切换
    const { atomicSwitch } = require('./atomic.js');
    atomicSwitch(sourcePath, targetPath);

    // 更新状态
    const hash = fileHash(targetPath);
    adapter.writeState(variant, hash);

    return {
      success: true,
      variant,
      message: `Switched to "${variant}"`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to switch: ${error.message}`
    };
  }
}

/**
 * 预览切换差异
 */
export function previewSwitch(service, variant) {
  return switchConfig(service, variant, { dryRun: true });
}

function listAvailableServices() {
  const { listServices } = require('./registry.js');
  return listServices().map(s => s.id);
}

function listAvailableVariants(adapter) {
  return adapter.scanVariants().map(v => v.name);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/switch-flow.test.js --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/switcher.js tests/integration/switch-flow.test.js
git commit -m "feat: implement profile isolation in switcher"
```

---

## Task 4: 修改 switch 命令输出

**Files:**
- Modify: `src/commands/switch.js`

**Step 1: Write minimal implementation**

修改 `src/commands/switch.js`：

```javascript
import chalk from 'chalk';
import { switchConfig } from '../core/switcher.js';
import { getAdapter, listServices } from '../core/registry.js';
import { t } from '../utils/i18n.js';
import { logSwitch } from '../utils/logger.js';

/**
 * switch 命令 - 切换配置
 * @param {string} variant - 配置变体名称
 * @param {object} options - { service: string, dryRun: boolean, noPersist: boolean }
 */
export async function switchCommand(variant, options = {}) {
  const { service = 'claude', dryRun = false, noPersist = false } = options;

  // 验证服务是否存在
  if (!getAdapter(service)) {
    console.error(chalk.red(t('switch.unknownService', { name: service })));
    console.log(chalk.yellow(`${t('switch.availableServices')}:`), listServices().map(s => s.id).join(', '));
    return 1;
  }

  if (!variant) {
    console.error(chalk.red(t('switch.missingVariant')));
    console.log(chalk.gray(t('switch.usage')));
    return 1;
  }

  const result = switchConfig(service, variant, { dryRun, noPersist });

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
    if (result.profileDir) {
      console.log(chalk.gray(`  Profile: ${result.profileDir}`));
    }
    return 0;
  }

  // 成功时只输出 export 命令（供 eval 执行）
  if (result.exportCommand) {
    console.log(result.exportCommand);
  } else {
    // 非 Claude 服务的输出
    console.log(chalk.green('✓ '), result.message);
  }

  return 0;
}
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/switch.js
git commit -m "feat: update switch command to output export command"
```

---

## Task 5: 更新 list 命令显示 profiles 信息

**Files:**
- Modify: `src/commands/list.js`
- Modify: `src/core/config.js`

**Step 1: Ensure list works with profiles**

`scanVariants` 已在 Task 2 中更新，现在需要确保 `list` 命令能正确显示。

运行现有测试验证：
Run: `npm test -- tests/scan.test.js --run`
Expected: PASS

**Step 2: Commit**

```bash
git add src/commands/list.js src/core/config.js
git commit -m "feat: list command supports profiles display"
```

---

## Task 6: 运行完整测试并修复

**Step 1: Run all tests**

Run: `npm test -- --run`

**Step 2: Fix any failing tests**

根据失败信息修复代码。

**Step 3: Commit fixes if needed**

```bash
git add -A
git commit -m "fix: resolve test failures for profile isolation"
```

---

## Task 7: 手动验证

**Step 1: 验证切换功能**

```bash
# 构建项目
npm run build

# 测试切换（假设有 glm 配置）
eval "$(node bin/cs-cli.js switch glm)"

# 验证环境变量
echo $CLAUDE_CONFIG_DIR

# 检查 shell 配置文件
cat ~/.zshrc | grep -A3 "cs-cli-auto"
```

**Step 2: 验证隔离效果**

- 在终端 A 执行切换
- 在终端 B 检查环境变量是否不受影响
- 新开终端 C 验证是否自动加载最新配置

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete profile isolation implementation"
```

---

## 验收清单

- [ ] `eval "$(cs-cli switch glm)"` 设置环境变量
- [ ] 其他已运行窗口不受影响
- [ ] 新终端自动使用最新配置
- [ ] 自动迁移 legacy 配置
- [ ] Windows PowerShell 支持
- [ ] 所有测试通过
