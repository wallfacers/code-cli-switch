# StatusLine Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 statusline 从单行输出重构为双行 TUI 布局，保留厂商显示功能。

**Architecture:** 新增 `renderRow1` / `renderRow2` 两个行级函数，`renderStatusBar` 作为组合入口调用它们，`bin/statusline.js` 从 stdin JSON 读取 `model` 和 `status` 新字段并透传。

**Tech Stack:** Node.js ESM, ANSI 转义码, vitest

---

### Task 1: 新增常量与辅助函数（parseModelName + renderStatus）

**Files:**
- Modify: `src/core/statusline.js`
- Test: `tests/unit/statusline.test.js`

**Step 1: 在 `statusline.js` 中新增常量和两个函数**

在 `RESET` 常量之后、`PROGRESS_COLORS` 之前，添加：

```js
/**
 * 新增 ANSI 样式常量
 */
export const DIM = '\x1b[2m';
export const CYAN = '\x1b[36m';
export const GREEN_BRIGHT = '\x1b[32m';
```

在文件末尾（`generateStatusLineConfig` 之前）添加：

```js
/**
 * 将原始模型 ID 解析为简短显示名
 * @param {string|null} modelStr - 原始模型 ID（如 "claude-opus-4-6"）
 * @returns {string} 简短显示名（如 "Opus 4.6"）
 */
export function parseModelName(modelStr) {
  if (!modelStr) return '';
  const s = String(modelStr).toLowerCase();

  if (s.startsWith('claude-')) {
    const rest = s.slice(7);
    const parts = rest.split('-');
    const family = parts[0];
    const versionParts = [];
    for (let i = 1; i < parts.length; i++) {
      if (/^\d/.test(parts[i]) && parts[i].length <= 4) {
        versionParts.push(parts[i]);
      } else {
        break;
      }
    }
    const familyDisplay = family.charAt(0).toUpperCase() + family.slice(1);
    return versionParts.length > 0
      ? `${familyDisplay} ${versionParts.join('.')}`
      : familyDisplay;
  }

  if (s.startsWith('gpt-')) {
    return 'GPT-' + modelStr.slice(4);
  }

  if (s.startsWith('gemini-')) {
    return 'Gemini ' + modelStr.slice(7);
  }

  return modelStr;
}

/**
 * 将状态字符串渲染为带圆点的 dim 文本
 * @param {string|null} status - 状态字符串（如 "thinking"、"idle"）
 * @returns {string} 带颜色的状态文本
 */
export function renderStatus(status) {
  const text = status ? `● ${status}` : '● active';
  return `${DIM}${text}${RESET}`;
}
```

**Step 2: 在测试文件 import 中加入新导出**

在 `tests/unit/statusline.test.js` 的 import 列表中增加：
```js
import {
  // ... 已有导入 ...
  DIM,
  parseModelName,
  renderStatus,
} from '../../src/core/statusline.js';
```

**Step 3: 在测试文件末尾追加新的 describe 块**

```js
describe('parseModelName', () => {
  it('should parse claude opus model', () => {
    expect(parseModelName('claude-opus-4-6')).toBe('Opus 4.6');
  });

  it('should parse claude sonnet model', () => {
    expect(parseModelName('claude-sonnet-4-5')).toBe('Sonnet 4.5');
  });

  it('should parse claude model with date suffix', () => {
    expect(parseModelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
  });

  it('should parse gpt model', () => {
    expect(parseModelName('gpt-4o')).toBe('GPT-4o');
  });

  it('should parse gemini model', () => {
    expect(parseModelName('gemini-2.0-flash')).toBe('Gemini 2.0-flash');
  });

  it('should return empty string for null', () => {
    expect(parseModelName(null)).toBe('');
  });

  it('should return original string for unknown format', () => {
    expect(parseModelName('my-custom-model')).toBe('my-custom-model');
  });
});

describe('renderStatus', () => {
  it('should render thinking status with dim color', () => {
    const result = renderStatus('thinking');
    expect(result).toContain('● thinking');
    expect(result).toContain(DIM);
    expect(result).toContain(RESET);
  });

  it('should render active when status is null', () => {
    expect(renderStatus(null)).toContain('● active');
  });

  it('should render idle status', () => {
    expect(renderStatus('idle')).toContain('● idle');
  });
});
```

**Step 4: 运行测试验证通过**

```
npx vitest run tests/unit/statusline.test.js
```
预期：新增的 10 个测试全部 PASS，已有测试不受影响。

**Step 5: Commit**

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "feat: add parseModelName and renderStatus helpers to statusline"
```

---

### Task 2: 重构 renderProgressBar（字符 ▓░ → ●○，宽度 11，含百分比）

**Files:**
- Modify: `src/core/statusline.js`
- Test: `tests/unit/statusline.test.js`

**Step 1: 更新 `renderProgressBar` 实现**

将现有函数替换为：

```js
export function renderProgressBar(percent, width = 11) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getProgressColor(percent);
  return `${color}${'●'.repeat(filled)}${'○'.repeat(empty)} ${percent}%${RESET}`;
}
```

**Step 2: 更新测试中的 renderProgressBar describe 块**

将 `tests/unit/statusline.test.js` 中的 `describe('renderProgressBar', ...)` 替换为：

```js
describe('renderProgressBar', () => {
  it('should render 0% progress bar with all empty circles', () => {
    const bar = renderProgressBar(0);
    expect(bar).toContain('○'.repeat(11));
    expect(bar).not.toContain('●');
    expect(bar).toContain('0%');
  });

  it('should render ~50% progress bar', () => {
    const bar = renderProgressBar(50);
    // Math.round(50/100 * 11) = 6 filled, 5 empty
    expect(bar).toContain('●'.repeat(6));
    expect(bar).toContain('○'.repeat(5));
    expect(bar).toContain('50%');
  });

  it('should render 100% progress bar with all filled circles', () => {
    const bar = renderProgressBar(100);
    expect(bar).toContain('●'.repeat(11));
    expect(bar).not.toContain('○');
    expect(bar).toContain('100%');
  });

  it('should include RESET at the end', () => {
    const bar = renderProgressBar(50);
    expect(bar.endsWith(RESET)).toBe(true);
  });
});
```

**Step 3: 运行测试**

```
npx vitest run tests/unit/statusline.test.js
```
预期：`renderProgressBar` 的 4 个测试全部 PASS。

**Step 4: Commit**

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "refactor: change progress bar chars to ●○, width 11, include percent"
```

---

### Task 3: 新增 renderRow1 和 renderRow2

**Files:**
- Modify: `src/core/statusline.js`
- Test: `tests/unit/statusline.test.js`

**Step 1: 在 `statusline.js` 中添加 renderRow1 和 renderRow2**

在 `renderStatusBar` 函数之前插入：

```js
/**
 * 渲染第一行：厂商+模型名 | 目录(分支) | 运行状态
 * @param {string} vendor - 厂商名称
 * @param {string|null} model - 原始模型 ID（如 "claude-opus-4-6"）
 * @param {string|null} cwd - 当前工作目录
 * @param {string|null} status - 运行状态（如 "thinking"）
 * @returns {string} 格式化的第一行字符串
 */
export function renderRow1(vendor, model, cwd, status) {
  const sep = `${DIM} | ${RESET}`;

  // 模块 A：厂商: 模型名
  const vendorColor = getVendorColor(vendor);
  const vendorName = formatVendor(vendor);
  const modelName = parseModelName(model);
  const moduleA = modelName
    ? `${vendorColor}${vendorName}: ${modelName}${RESET}`
    : `${vendorColor}${vendorName}${RESET}`;

  // 模块 B：目录名 (分支)
  const dirName = getDirName(cwd);
  const branch = getGitBranch(cwd);
  let moduleB = '';
  if (dirName) {
    moduleB = `${CYAN}${dirName}${RESET}`;
    if (branch) {
      moduleB += ` ${GREEN_BRIGHT}(${branch})${RESET}`;
    }
  }

  // 模块 C：运行状态
  const moduleC = status ? renderStatus(status) : '';

  const parts = [moduleA];
  if (moduleB) parts.push(moduleB);
  if (moduleC) parts.push(moduleC);

  return parts.join(sep);
}

/**
 * 渲染第二行：context 标签 + 进度条
 * @param {object|null} contextData - context_window 数据
 * @returns {string} 格式化的第二行字符串
 */
export function renderRow2(contextData) {
  const percent = calculateContextPercent(contextData);
  const bar = renderProgressBar(percent);
  return `context   ${bar}`;
}
```

**Step 2: 在测试文件 import 中增加新导出**

```js
import {
  // ... 已有导入 ...
  CYAN,
  GREEN_BRIGHT,
  renderRow1,
  renderRow2,
} from '../../src/core/statusline.js';
```

**Step 3: 在测试文件末尾追加新的 describe 块**

```js
describe('renderRow1', () => {
  it('should render vendor name in uppercase with vendor color', () => {
    const result = renderRow1('glm', null, null, null);
    expect(result).toContain('GLM');
    expect(result).toContain(VENDOR_COLORS.glm);
  });

  it('should include model name when provided', () => {
    const result = renderRow1('claude', 'claude-opus-4-6', null, null);
    expect(result).toContain('CLAUDE: Opus 4.6');
  });

  it('should include directory name when cwd provided', () => {
    const result = renderRow1('glm', null, '/home/user/my-project', null);
    expect(result).toContain('my-project');
    expect(result).toContain(CYAN);
  });

  it('should include status when provided', () => {
    const result = renderRow1('glm', null, null, 'thinking');
    expect(result).toContain('● thinking');
    expect(result).toContain(DIM);
  });

  it('should omit status module when status is null', () => {
    const result = renderRow1('glm', null, null, null);
    expect(result).not.toContain('●');
  });

  it('should use separator between modules', () => {
    const result = renderRow1('glm', null, '/home/user/project', 'thinking');
    expect(result).toContain(' | ');
  });
});

describe('renderRow2', () => {
  const contextData = {
    context_window_size: 200000,
    current_usage: {
      input_tokens: 50000,
      cache_creation_input_tokens: 30000,
      cache_read_input_tokens: 20000,
    },
  };

  it('should start with "context" label', () => {
    const result = renderRow2(contextData);
    expect(result.startsWith('context')).toBe(true);
  });

  it('should include percent value', () => {
    const result = renderRow2(contextData);
    expect(result).toContain('50%');
  });

  it('should include progress dots', () => {
    const result = renderRow2(contextData);
    expect(result).toContain('●');
    expect(result).toContain('○');
  });

  it('should show 0% when contextData is null', () => {
    const result = renderRow2(null);
    expect(result).toContain('0%');
  });
});
```

**Step 4: 运行测试**

```
npx vitest run tests/unit/statusline.test.js
```
预期：新增的 10 个测试全部 PASS。

**Step 5: Commit**

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "feat: add renderRow1 and renderRow2 for 2-row statusline layout"
```

---

### Task 4: 重构 renderStatusBar（新签名 + 双行输出 + 更新旧测试）

**Files:**
- Modify: `src/core/statusline.js`
- Test: `tests/unit/statusline.test.js`

**Step 1: 替换 `renderStatusBar` 实现**

将现有 `renderStatusBar` 函数替换为：

```js
/**
 * 渲染完整状态栏（双行）
 * @param {string} vendor - 厂商名称
 * @param {object|null} contextData - context_window 数据
 * @param {string|null} cwd - 当前工作目录
 * @param {string|null} model - 原始模型 ID
 * @param {string|null} status - 运行状态
 * @returns {string} 双行状态栏字符串（或无 contextData 时的单行）
 */
export function renderStatusBar(vendor, contextData, cwd = null, model = null, status = null) {
  const row1 = renderRow1(vendor, model, cwd, status);
  if (!contextData) {
    return row1;
  }
  return row1 + '\n' + renderRow2(contextData);
}
```

**Step 2: 更新测试中的 renderStatusBar describe 块**

将 `tests/unit/statusline.test.js` 中的 `describe('renderStatusBar', ...)` 替换为：

```js
describe('renderStatusBar', () => {
  const contextData = {
    context_window_size: 200000,
    current_usage: {
      input_tokens: 50000,
      cache_creation_input_tokens: 30000,
      cache_read_input_tokens: 20000,
    },
  };

  it('should render 2-row output when contextData is provided', () => {
    const result = renderStatusBar('glm', contextData);
    expect(result).toContain('\n');
    expect(result).toContain('GLM');
    expect(result).toContain('context');
    expect(result).toContain('50%');
  });

  it('should include vendor color', () => {
    const result = renderStatusBar('glm', contextData);
    expect(result).toContain(VENDOR_COLORS.glm);
  });

  it('should return single row when contextData is null', () => {
    const result = renderStatusBar('kimi', null);
    expect(result).not.toContain('\n');
    expect(result).toContain('KIMI');
  });

  it('should include directory name when cwd provided', () => {
    const result = renderStatusBar('glm', contextData, '/home/user/my-project');
    expect(result).toContain('my-project');
  });

  it('should not include directory emoji when cwd is null', () => {
    const result = renderStatusBar('glm', contextData, null);
    expect(result).not.toContain('📁');
  });

  it('should include model name when provided', () => {
    const result = renderStatusBar('claude', contextData, null, 'claude-sonnet-4-5');
    expect(result).toContain('Sonnet 4.5');
  });

  it('should include status when provided', () => {
    const result = renderStatusBar('glm', contextData, null, null, 'thinking');
    expect(result).toContain('● thinking');
  });
});
```

**Step 3: 运行全部 statusline 测试**

```
npx vitest run tests/unit/statusline.test.js
```
预期：所有测试 PASS（包括已有的 getDirName、getVendorColor 等）。

**Step 4: 运行集成测试确认无回归**

```
npx vitest run tests/integration/statusline-inject.test.js
```
预期：全部 PASS（inject 测试不涉及渲染逻辑，应不受影响）。

**Step 5: Commit**

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "refactor: renderStatusBar now outputs 2-row layout with new signature"
```

---

### Task 5: 更新 bin/statusline.js 读取 model 和 status 字段

**Files:**
- Modify: `bin/statusline.js`

**Step 1: 更新 stdin 解析逻辑**

将 `bin/statusline.js` 的 `process.stdin.on('end', ...)` 回调中的解析块替换为：

```js
process.stdin.on('end', () => {
  if (finished) return;
  finished = true;

  let contextData = null;
  let cwd = null;
  let model = null;
  let status = null;

  if (inputData.trim()) {
    try {
      const parsed = JSON.parse(inputData);
      contextData = parsed.context_window || null;
      cwd = parsed.cwd || null;
      model = parsed.model || null;
      status = parsed.status || null;
    } catch (e) {
      // JSON 解析失败，使用回退显示
    }
  }

  if (!contextData) {
    console.log(renderVendor(vendor));
  } else {
    console.log(renderStatusBar(vendor, contextData, cwd, model, status));
  }
});
```

同时更新超时回退（保持不变，已是 `renderVendor(vendor)`）。

**Step 2: 手动验证（无 stdin 输入）**

```
echo "" | node bin/statusline.js claude
```
预期输出：`CLAUDE`（带颜色，单行回退）

**Step 3: 手动验证（带 model 和 status 的完整 JSON）**

```
echo "{\"context_window\":{\"context_window_size\":200000,\"current_usage\":{\"input_tokens\":50000}},\"cwd\":\"C:/test/project\",\"model\":\"claude-opus-4-6\",\"status\":\"thinking\"}" | node bin/statusline.js claude
```
预期输出（两行）：
```
CLAUDE: Opus 4.6 | project | ● thinking
context   ●●●○○○○○○○○ 25%
```

**Step 4: 运行完整测试套件确认无回归**

```
npx vitest run
```
预期：所有测试 PASS。

**Step 5: Commit**

```bash
git add bin/statusline.js
git commit -m "feat: statusline script reads model and status from stdin JSON"
```
