# StatusLine 增强显示实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 增强 Claude Code 状态栏显示，从单调的厂商名称升级为带上下文进度条的丰富展示。

**Architecture:** 在现有 `src/core/statusline.js` 基础上新增进度条渲染和上下文计算函数，重写 `bin/statusline.js` 支持 stdin JSON 输入。

**Tech Stack:** Node.js ES Modules, ANSI 颜色码, vitest

---

## Task 1: 添加进度条颜色常量和颜色选择函数

**Files:**
- Modify: `src/core/statusline.js`
- Modify: `tests/unit/statusline.test.js`

### Step 1: 写失败的测试 - 进度条颜色选择

在 `tests/unit/statusline.test.js` 末尾添加:

```javascript
import { getProgressColor, PROGRESS_COLORS } from '../../src/core/statusline.js';

describe('getProgressColor', () => {
  it('should return safe color for percent < 50', () => {
    expect(getProgressColor(0)).toBe(PROGRESS_COLORS.safe);
    expect(getProgressColor(25)).toBe(PROGRESS_COLORS.safe);
    expect(getProgressColor(49)).toBe(PROGRESS_COLORS.safe);
  });

  it('should return warning color for percent 50-79', () => {
    expect(getProgressColor(50)).toBe(PROGRESS_COLORS.warning);
    expect(getProgressColor(65)).toBe(PROGRESS_COLORS.warning);
    expect(getProgressColor(79)).toBe(PROGRESS_COLORS.warning);
  });

  it('should return danger color for percent >= 80', () => {
    expect(getProgressColor(80)).toBe(PROGRESS_COLORS.danger);
    expect(getProgressColor(90)).toBe(PROGRESS_COLORS.danger);
    expect(getProgressColor(100)).toBe(PROGRESS_COLORS.danger);
  });
});
```

### Step 2: 运行测试确认失败

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: FAIL - getProgressColor is not defined

### Step 3: 实现进度条颜色常量和选择函数

在 `src/core/statusline.js` 中，在 `RESET` 常量后添加:

```javascript
/**
 * 进度条渐变颜色
 */
export const PROGRESS_COLORS = {
  safe: '\x1b[32m',    // 绿色 <50%
  warning: '\x1b[33m', // 黄色 50-79%
  danger: '\x1b[31m'   // 红色 >=80%
};

/**
 * 根据百分比获取进度条颜色
 * @param {number} percent - 使用百分比 (0-100)
 * @returns {string} ANSI 颜色码
 */
export function getProgressColor(percent) {
  if (percent >= 80) return PROGRESS_COLORS.danger;
  if (percent >= 50) return PROGRESS_COLORS.warning;
  return PROGRESS_COLORS.safe;
}
```

### Step 4: 运行测试确认通过

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: PASS

### Step 5: Commit

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "$(cat <<'EOF'
feat(statusline): add progress bar color constants and selector

- Add PROGRESS_COLORS (safe/warning/danger)
- Add getProgressColor function with threshold logic
- Add unit tests for color selection

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 添加进度条渲染函数

**Files:**
- Modify: `src/core/statusline.js`
- Modify: `tests/unit/statusline.test.js`

### Step 1: 写失败的测试 - 进度条渲染

在 `tests/unit/statusline.test.js` 末尾添加:

```javascript
import { renderProgressBar, RESET } from '../../src/core/statusline.js';

describe('renderProgressBar', () => {
  it('should render 0% progress bar', () => {
    const bar = renderProgressBar(0);
    expect(bar).toContain('░'.repeat(10));
    expect(bar).not.toContain('▓');
  });

  it('should render 50% progress bar', () => {
    const bar = renderProgressBar(50);
    expect(bar).toContain('▓'.repeat(5));
    expect(bar).toContain('░'.repeat(5));
  });

  it('should render 100% progress bar', () => {
    const bar = renderProgressBar(100);
    expect(bar).toContain('▓'.repeat(10));
    expect(bar).not.toContain('░');
  });

  it('should include RESET at the end', () => {
    const bar = renderProgressBar(50);
    expect(bar.endsWith(RESET)).toBe(true);
  });
});
```

### Step 2: 运行测试确认失败

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: FAIL - renderProgressBar is not defined

### Step 3: 实现进度条渲染函数

在 `src/core/statusline.js` 中，在 `getProgressColor` 函数后添加:

```javascript
/**
 * 渲染进度条
 * @param {number} percent - 使用百分比 (0-100)
 * @param {number} width - 进度条宽度 (默认 10)
 * @returns {string} 带颜色的进度条字符串
 */
export function renderProgressBar(percent, width = 10) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getProgressColor(percent);
  return `${color}${'▓'.repeat(filled)}${'░'.repeat(empty)}${RESET}`;
}
```

### Step 4: 运行测试确认通过

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: PASS

### Step 5: Commit

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "$(cat <<'EOF'
feat(statusline): add progress bar rendering function

- Add renderProgressBar with configurable width
- Include color gradient based on percentage
- Add unit tests for progress bar rendering

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 添加上下文百分比计算函数

**Files:**
- Modify: `src/core/statusline.js`
- Modify: `tests/unit/statusline.test.js`

### Step 1: 写失败的测试 - 上下文计算

在 `tests/unit/statusline.test.js` 末尾添加:

```javascript
import { calculateContextPercent } from '../../src/core/statusline.js';

describe('calculateContextPercent', () => {
  it('should calculate percent from current_usage', () => {
    const contextData = {
      context_window_size: 200000,
      current_usage: {
        input_tokens: 50000,
        cache_creation_input_tokens: 30000,
        cache_read_input_tokens: 20000
      }
    };
    // (50000 + 30000 + 20000) / 200000 * 100 = 50%
    expect(calculateContextPercent(contextData)).toBe(50);
  });

  it('should return 0 when current_usage is null', () => {
    const contextData = {
      context_window_size: 200000,
      current_usage: null
    };
    expect(calculateContextPercent(contextData)).toBe(0);
  });

  it('should return 0 when contextData is null', () => {
    expect(calculateContextPercent(null)).toBe(0);
  });

  it('should return 0 when contextData is undefined', () => {
    expect(calculateContextPercent(undefined)).toBe(0);
  });

  it('should handle partial usage data', () => {
    const contextData = {
      context_window_size: 100000,
      current_usage: {
        input_tokens: 25000
      }
    };
    // 25000 / 100000 * 100 = 25%
    expect(calculateContextPercent(contextData)).toBe(25);
  });
});
```

### Step 2: 运行测试确认失败

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: FAIL - calculateContextPercent is not defined

### Step 3: 实现上下文百分比计算函数

在 `src/core/statusline.js` 中，在 `renderProgressBar` 函数后添加:

```javascript
/**
 * 计算上下文窗口使用百分比
 * @param {object|null} contextData - context_window 数据
 * @returns {number} 使用百分比 (0-100)
 */
export function calculateContextPercent(contextData) {
  if (!contextData || !contextData.current_usage) {
    return 0;
  }

  const usage = contextData.current_usage;
  const totalTokens =
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);

  const windowSize = contextData.context_window_size || 200000;

  return Math.round((totalTokens / windowSize) * 100);
}
```

### Step 4: 运行测试确认通过

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: PASS

### Step 5: Commit

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "$(cat <<'EOF'
feat(statusline): add context percentage calculation

- Add calculateContextPercent function
- Handle null/undefined gracefully
- Support partial usage data
- Add unit tests for context calculation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 添加完整状态栏渲染函数

**Files:**
- Modify: `src/core/statusline.js`
- Modify: `tests/unit/statusline.test.js`

### Step 1: 写失败的测试 - 完整状态栏渲染

在 `tests/unit/statusline.test.js` 末尾添加:

```javascript
import { renderStatusBar, VENDOR_COLORS, RESET } from '../../src/core/statusline.js';

describe('renderStatusBar', () => {
  const contextData = {
    context_window_size: 200000,
    current_usage: {
      input_tokens: 50000,
      cache_creation_input_tokens: 30000,
      cache_read_input_tokens: 20000
    }
  };

  it('should render status bar with vendor and context', () => {
    const result = renderStatusBar('glm', contextData);
    expect(result).toContain('厂商:GLM');
    expect(result).toContain('上下文:50%');
    expect(result).toContain('▓');
    expect(result).toContain('░');
  });

  it('should include vendor color', () => {
    const result = renderStatusBar('glm', contextData);
    expect(result).toContain(VENDOR_COLORS.glm);
  });

  it('should handle null contextData', () => {
    const result = renderStatusBar('kimi', null);
    expect(result).toContain('厂商:KIMI');
    expect(result).toContain('上下文:0%');
  });
});
```

### Step 2: 运行测试确认失败

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: FAIL - renderStatusBar is not defined

### Step 3: 实现完整状态栏渲染函数

在 `src/core/statusline.js` 中，在 `calculateContextPercent` 函数后添加:

```javascript
/**
 * 渲染完整状态栏
 * @param {string} vendor - 厂商名称
 * @param {object|null} contextData - context_window 数据
 * @returns {string} 格式化的状态栏字符串
 */
export function renderStatusBar(vendor, contextData) {
  const vendorColor = getVendorColor(vendor);
  const vendorName = formatVendor(vendor);
  const vendorPart = `${vendorColor}厂商:${vendorName}${RESET}`;

  const percent = calculateContextPercent(contextData);
  const bar = renderProgressBar(percent);

  return `${vendorPart} | 上下文:${percent}% ${bar}`;
}
```

### Step 4: 运行测试确认通过

Run: `npm test -- tests/unit/statusline.test.js --run`
Expected: PASS

### Step 5: Commit

```bash
git add src/core/statusline.js tests/unit/statusline.test.js
git commit -m "$(cat <<'EOF'
feat(statusline): add complete status bar rendering

- Add renderStatusBar function combining vendor and context
- Format: "厂商:GLM | 上下文:50% ▓▓▓▓▓░░░░░"
- Add unit tests for complete status bar

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 重写 bin/statusline.js 支持 stdin JSON

**Files:**
- Modify: `bin/statusline.js`

### Step 1: 重写 statusline 脚本

完全重写 `bin/statusline.js`:

```javascript
#!/usr/bin/env node
/**
 * StatusLine 脚本 - 显示厂商名称和上下文使用情况
 *
 * 用法: node statusline.js <vendor>
 *
 * Claude Code 通过 stdin 传递 JSON 数据，命令行参数传递厂商名以确保多窗口隔离。
 */

import { renderVendor, renderStatusBar } from '../src/core/statusline.js';

// 从命令行参数获取厂商名
const vendor = process.argv[2];

if (!vendor) {
  console.log('UNKNOWN');
  process.exit(0);
}

// 从 stdin 读取 JSON 数据
let inputData = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  // 尝试解析 JSON
  let contextData = null;

  if (inputData.trim()) {
    try {
      const parsed = JSON.parse(inputData);
      contextData = parsed.context_window || null;
    } catch (e) {
      // JSON 解析失败，使用回退显示
    }
  }

  // 如果没有 context_data，回退到简单显示
  if (!contextData) {
    console.log(renderVendor(vendor));
  } else {
    console.log(renderStatusBar(vendor, contextData));
  }
});

// 设置超时，防止 stdin 无数据时阻塞
setTimeout(() => {
  console.log(renderVendor(vendor));
  process.exit(0);
}, 100);
```

### Step 2: 手动测试脚本

Run: `echo '{"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000,"cache_creation_input_tokens":30000,"cache_read_input_tokens":20000}}}' | node bin/statusline.js glm`
Expected: `厂商:GLM | 上下文:50% ▓▓▓▓▓░░░░░` (带颜色)

Run: `node bin/statusline.js kimi`
Expected: `KIMI` (带颜色，无 stdin 时的回退)

### Step 3: Commit

```bash
git add bin/statusline.js
git commit -m "$(cat <<'EOF'
feat(statusline): rewrite CLI script to support stdin JSON

- Read context_window data from stdin
- Fall back to simple vendor display on error
- Add 100ms timeout to prevent blocking
- Maintain vendor argument for multi-window isolation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 更新文档

**Files:**
- Modify: `README.md`

### Step 1: 更新 README.md 中的 StatusLine 章节

找到 `## StatusLine 状态栏显示` 章节，替换为:

```markdown
## StatusLine 状态栏显示

cs-cli 支持在 Claude Code 状态栏显示当前使用的厂商名称和上下文使用情况。

### 自动启用

当你使用 `cs-cli switch` 切换配置时，会自动在 `settings.json` 中注入 `statusLine` 配置。

### 效果

状态栏显示格式：`厂商:GLM | 上下文:35% ▓▓▓░░░░░░`

| 厂商 | 颜色 | 示例 |
|------|------|------|
| GLM | 亮绿色 | 厂商:GLM |
| KIMI | 青色 | 厂商:KIMI |
| MINIMAX | 金色 | 厂商:MINIMAX |
| DeepSeek | 蓝色 | 厂商:DEEPSEEK |
| Qwen | 橙色 | 厂商:QWEN |
| DuckCoding | 紫色 | 厂商:DUCKCODING |
| Claude | 粉紫色 | 厂商:CLAUDE |
| OpenAI | 绿色 | 厂商:OPENAI |
| Gemini | 天蓝色 | 厂商:GEMINI |

### 上下文进度条

进度条颜色随使用率变化：
- **绿色** (<50%) - 安全区间
- **黄色** (50-79%) - 注意区间
- **红色** (≥80%) - 警示区间

### 多窗口隔离

每个终端窗口显示其启动时的厂商名称和上下文使用情况，不会因为其他窗口切换而改变。
```

### Step 2: Commit

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: update statusLine documentation for enhanced display

- Add context progress bar description
- Add color gradient explanation
- Update vendor table format

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 运行完整测试

**Files:** 无新增

### Step 1: 运行所有测试

Run: `npm test -- --run`
Expected: 所有 74+ 测试通过

### Step 2: 确认功能正常

Run: `echo '{"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":160000}}}' | node bin/statusline.js glm`
Expected: 显示红色进度条 (80%)

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | 添加进度条颜色常量和选择函数 | `src/core/statusline.js`, `tests/unit/statusline.test.js` |
| 2 | 添加进度条渲染函数 | `src/core/statusline.js`, `tests/unit/statusline.test.js` |
| 3 | 添加上下文百分比计算函数 | `src/core/statusline.js`, `tests/unit/statusline.test.js` |
| 4 | 添加完整状态栏渲染函数 | `src/core/statusline.js`, `tests/unit/statusline.test.js` |
| 5 | 重写 CLI 脚本支持 stdin | `bin/statusline.js` |
| 6 | 更新文档 | `README.md` |
| 7 | 运行完整测试 | - |
