# StatusLine 厂商显示功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Claude Code 状态栏显示当前窗口使用的模型厂商名称，使用不同颜色区分。

**Architecture:** 创建独立的 statusline 核心模块提供颜色映射和注入逻辑，修改 switcher.js 在切换时自动注入 statusLine 配置，创建 bin/statusline.js 脚本输出带颜色的厂商名。

**Tech Stack:** Node.js ES Modules, ANSI 颜色码, vitest

---

## Task 1: 创建 statusline 核心模块

**Files:**
- Create: `src/core/statusline.js`
- Create: `tests/unit/statusline.test.js`

### Step 1: 写失败的测试 - 颜色映射函数

创建 `tests/unit/statusline.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { getVendorColor, formatVendor, injectStatusLine, VENDOR_COLORS } from '../../src/core/statusline.js';

describe('statusline', () => {
  describe('getVendorColor', () => {
    it('should return correct color for known vendors', () => {
      expect(getVendorColor('glm')).toBe(VENDOR_COLORS.glm);
      expect(getVendorColor('kimi')).toBe(VENDOR_COLORS.kimi);
      expect(getVendorColor('minimax')).toBe(VENDOR_COLORS.minimax);
    });

    it('should return default color for unknown vendors', () => {
      expect(getVendorColor('unknown-vendor')).toBe(VENDOR_COLORS.default);
    });
  });

  describe('formatVendor', () => {
    it('should uppercase vendor name', () => {
      expect(formatVendor('glm')).toBe('GLM');
      expect(formatVendor('Kimi')).toBe('KIMI');
    });

    it('should handle empty string', () => {
      expect(formatVendor('')).toBe('UNKNOWN');
    });

    it('should handle undefined', () => {
      expect(formatVendor(undefined)).toBe('UNKNOWN');
    });
  });
});
```

### Step 2: 运行测试确认失败

Run: `npm test -- tests/unit/statusline.test.js`
Expected: FAIL - 模块不存在

### Step 3: 实现颜色映射和格式化函数

创建 `src/core/statusline.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 获取当前模块所在的项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * 厂商颜色映射表 (ANSI 256色)
 */
export const VENDOR_COLORS = {
  // 国内大模型
  'glm': '\x1b[38;5;46m',      // 亮绿色 - 智谱 GLM
  'kimi': '\x1b[38;5;51m',     // 青色 - 月之暗面
  'minimax': '\x1b[38;5;220m', // 金色 - MiniMax
  'deepseek': '\x1b[38;5;33m', // 蓝色 - DeepSeek
  'qwen': '\x1b[38;5;209m',    // 橙色 - 通义千问
  'duckcoding': '\x1b[38;5;105m', // 紫色 - DuckCoding

  // 国际大模型
  'claude': '\x1b[38;5;175m',  // 粉紫色 - Anthropic
  'openai': '\x1b[38;5;76m',   // 绿色 - OpenAI
  'gemini': '\x1b[38;5;81m',   // 天蓝色 - Google

  // 其他
  'default': '\x1b[38;5;246m'  // 灰色 - 未知厂商
};

/**
 * ANSI 重置码
 */
export const RESET = '\x1b[0m';

/**
 * 获取厂商对应的颜色码
 * @param {string} vendor - 厂商名称
 * @returns {string} ANSI 颜色码
 */
export function getVendorColor(vendor) {
  if (!vendor) return VENDOR_COLORS.default;
  const key = vendor.toLowerCase();
  return VENDOR_COLORS[key] || VENDOR_COLORS.default;
}

/**
 * 格式化厂商名称（大写）
 * @param {string} vendor - 厂商名称
 * @returns {string} 格式化后的名称
 */
export function formatVendor(vendor) {
  if (!vendor) return 'UNKNOWN';
  return String(vendor).toUpperCase();
}

/**
 * 生成带颜色的厂商显示文本
 * @param {string} vendor - 厂商名称
 * @returns {string} 带颜色的文本
 */
export function renderVendor(vendor) {
  const color = getVendorColor(vendor);
  const name = formatVendor(vendor);
  return `${color}${name}${RESET}`;
}

/**
 * 获取 statusline 脚本的绝对路径
 * @returns {string} 脚本路径
 */
export function getStatuslineScriptPath() {
  return path.join(PROJECT_ROOT, 'bin', 'statusline.js');
}

/**
 * 生成 statusLine 配置
 * @param {string} vendor - 厂商名称
 * @returns {object} statusLine 配置对象
 */
export function generateStatusLineConfig(vendor) {
  const scriptPath = getStatuslineScriptPath();
  // 使用正斜杠确保跨平台兼容性
  const normalizedPath = scriptPath.replace(/\\/g, '/');

  return {
    type: 'command',
    command: `node "${normalizedPath}" ${vendor}`,
    padding: 0
  };
}

/**
 * 向 settings.json 注入 statusLine 配置
 * @param {string} filePath - settings.json 文件路径
 * @param {string} vendor - 厂商名称
 * @returns {{success: boolean, error?: string}}
 */
export function injectStatusLine(filePath, vendor) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);

    // 注入 statusLine 配置
    config.statusLine = generateStatusLineConfig(vendor);

    // 写回文件
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Step 4: 运行测试确认通过

Run: `npm test -- tests/unit/statusline.test.js`
Expected: PASS

### Step 5: Commit

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "$(cat <<'EOF'
feat: add statusline core module

- Add vendor color mapping (ANSI 256 colors)
- Add formatVendor and getVendorColor functions
- Add injectStatusLine for settings.json modification
- Add unit tests for core functions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建 statusline CLI 脚本

**Files:**
- Create: `bin/statusline.js`

### Step 1: 创建 statusline 脚本

创建 `bin/statusline.js`:

```javascript
#!/usr/bin/env node
/**
 * StatusLine 脚本 - 显示当前厂商名称
 *
 * 用法: node statusline.js <vendor>
 *
 * Claude Code 会通过 stdin 传递 JSON 数据，但我们只使用命令行参数中的厂商名
 * 以确保多窗口隔离。
 */

import { renderVendor } from '../src/core/statusline.js';

// 从命令行参数获取厂商名
const vendor = process.argv[2];

if (!vendor) {
  // 无参数时显示 UNKNOWN
  console.log('UNKNOWN');
  process.exit(0);
}

// 输出带颜色的厂商名
console.log(renderVendor(vendor));
```

### Step 2: 手动测试脚本

Run: `node bin/statusline.js glm`
Expected: `GLM` (亮绿色)

Run: `node bin/statusline.js kimi`
Expected: `KIMI` (青色)

Run: `node bin/statusline.js`
Expected: `UNKNOWN`

### Step 3: Commit

```bash
git add bin/statusline.js
git chmod +x bin/statusline.js 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat: add statusline CLI script

- Accept vendor name as command line argument
- Output colored vendor name for Claude Code status bar
- Handle missing vendor argument gracefully

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 修改 switcher.js 注入 statusLine

**Files:**
- Modify: `src/core/switcher.js`
- Create: `tests/integration/statusline-inject.test.js`

### Step 1: 写失败的测试 - 注入测试

创建 `tests/integration/statusline-inject.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { injectStatusLine } from '../../src/core/statusline.js';

describe('statusline inject', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cs-cli-statusline-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should inject statusLine into settings.json', () => {
    const settingsPath = join(tempDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ model: 'test' }, null, 2));

    const result = injectStatusLine(settingsPath, 'glm');
    expect(result.success).toBe(true);

    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.statusLine).toBeDefined();
    expect(updated.statusLine.type).toBe('command');
    expect(updated.statusLine.command).toContain('glm');
    expect(updated.statusLine.padding).toBe(0);
  });

  it('should preserve existing config', () => {
    const settingsPath = join(tempDir, 'settings.json');
    const originalConfig = {
      model: 'test',
      env: { API_KEY: 'secret' }
    };
    writeFileSync(settingsPath, JSON.stringify(originalConfig, null, 2));

    injectStatusLine(settingsPath, 'kimi');

    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.model).toBe('test');
    expect(updated.env.API_KEY).toBe('secret');
  });

  it('should return error for non-existent file', () => {
    const result = injectStatusLine(join(tempDir, 'not-exist.json'), 'glm');
    expect(result.success).toBe(false);
    expect(result.error).toBe('File not found');
  });
});
```

### Step 2: 运行测试确认通过

Run: `npm test -- tests/integration/statusline-inject.test.js`
Expected: PASS (injectStatusLine 已在 Task 1 实现)

### Step 3: 修改 switcher.js 调用注入函数

在 `src/core/switcher.js` 中：

1. 添加导入 (在文件顶部):
```javascript
import { injectStatusLine } from './statusline.js';
```

2. 在原子替换后、计算哈希前添加注入逻辑 (约第 94-98 行之间):

找到这段代码:
```javascript
    // 4. 使用进程隔离 + 原子操作进行切换
    isolatedOperation(service, (workDir) => {
      const tempPath = path.join(workDir, adapter.getBaseName());

      // 在会话目录准备文件
      fs.copyFileSync(sourcePath, tempPath);

      // 原子替换到目标位置
      atomicSwitch(tempPath, targetPath);
    });

    // 5. 计算哈希并更新状态
```

修改为:
```javascript
    // 4. 使用进程隔离 + 原子操作进行切换
    isolatedOperation(service, (workDir) => {
      const tempPath = path.join(workDir, adapter.getBaseName());

      // 在会话目录准备文件
      fs.copyFileSync(sourcePath, tempPath);

      // 原子替换到目标位置
      atomicSwitch(tempPath, targetPath);
    });

    // 5. 注入 statusLine 配置 (仅 Claude 服务)
    if (service === 'claude') {
      const injectResult = injectStatusLine(targetPath, variant);
      if (!injectResult.success) {
        // 注入失败不影响主流程，记录警告
        console.warn(`Warning: Failed to inject statusLine: ${injectResult.error}`);
      }
    }

    // 6. 计算哈希并更新状态
```

3. 更新后续注释编号 (6 → 7):
```javascript
    // 7. Codex 特殊处理：更新 auth.json
```

### Step 4: 运行所有测试确认通过

Run: `npm test`
Expected: 所有测试 PASS

### Step 5: Commit

```bash
git add src/core/switcher.js tests/integration/statusline-inject.test.js
git commit -m "$(cat <<'EOF'
feat: auto-inject statusLine on config switch

- Add injectStatusLine call in switchConfig function
- Only inject for Claude service
- Add integration tests for statusLine injection
- Log warning if injection fails (non-blocking)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 手动集成测试

**Files:** 无新增

### Step 1: 执行实际切换测试

Run: `node bin/cs-cli.js switch glm`
Expected: 成功切换

### Step 2: 验证 statusLine 配置已注入

Run: `cat C:\Users\Administrator\.claude\settings.json | grep -A3 statusLine`
Expected:
```json
"statusLine": {
  "type": "command",
  "command": "node \"D:/develop/java/source/code-cli-switch/bin/statusline.js\" glm",
  "padding": 0
}
```

### Step 3: 验证状态栏脚本工作

Run: `node bin/statusline.js glm`
Expected: 输出绿色的 `GLM`

---

## Task 5: 更新文档

**Files:**
- Modify: `README.md`

### Step 1: 在 README.md 添加状态栏功能说明

在适当位置添加:

```markdown
## StatusLine 状态栏显示

cs-cli 支持在 Claude Code 状态栏显示当前使用的厂商名称。

### 自动启用

当你使用 `cs-cli switch` 切换配置时，会自动在 `settings.json` 中注入 `statusLine` 配置。

### 效果

- **GLM** - 亮绿色
- **KIMI** - 青色
- **MINIMAX** - 金色
- **DeepSeek** - 蓝色
- **Claude** - 粉紫色

### 多窗口隔离

每个终端窗口显示其启动时的厂商名称，不会因为其他窗口切换而改变。
```

### Step 2: Commit

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add statusLine feature documentation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | 创建 statusline 核心模块 | `src/core/statusline.js`, `tests/unit/statusline.test.js` |
| 2 | 创建 CLI 脚本 | `bin/statusline.js` |
| 3 | 修改 switcher 注入配置 | `src/core/switcher.js`, `tests/integration/statusline-inject.test.js` |
| 4 | 手动集成测试 | - |
| 5 | 更新文档 | `README.md` |
