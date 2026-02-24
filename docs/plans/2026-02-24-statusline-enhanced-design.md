# StatusLine 增强显示设计文档

**日期**: 2026-02-24
**版本**: 1.0.0

## 1. 功能概述

增强 Claude Code 状态栏显示，从单调的厂商名称升级为丰富的上下文信息展示。

### 核心需求

- 显示厂商配置名称（带标签）
- 显示上下文窗口使用情况（百分比+进度条）
- 进度条颜色渐变警示
- 保持多窗口隔离

## 2. 最终效果

```
厂商:GLM | 上下文:35% ▓▓▓░░░░░░
```

**颜色方案**：
- `厂商:GLM` - 使用厂商专属颜色（GLM绿色、KIMI青色等）
- `上下文:` - 白色/默认色
- 进度条 - 渐变色：
  - `<50%` → 绿色 `▓`
  - `50-80%` → 黄色 `▓`
  - `>80%` → 红色 `▓`

**示例**：
```
厂商:GLM | 上下文:25% ▓▓░░░░░░░░  (绿色，安全)
厂商:KIMI | 上下文:65% ▓▓▓▓▓▓░░░░  (黄色，注意)
厂商:MINIMAX | 上下文:85% ▓▓▓▓▓▓▓▓░░ (红色，警示)
```

## 3. 数据来源

从 Claude Code 通过 stdin 传入的 JSON 数据：

```json
{
  "context_window": {
    "context_window_size": 200000,
    "current_usage": {
      "input_tokens": 8500,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  }
}
```

**计算公式**：
```
当前上下文 = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
使用百分比 = (当前上下文 / context_window_size) * 100
```

## 4. 技术方案

### 4.1 文件改动

| 文件 | 改动内容 |
|------|----------|
| `bin/statusline.js` | 重写：从 stdin 读取 JSON，解析并渲染状态栏 |
| `src/core/statusline.js` | 新增：进度条渲染函数、颜色渐变逻辑、完整状态栏渲染 |

### 4.2 核心逻辑

```javascript
// 1. 从 stdin 读取 JSON（异步）
// 2. 从命令行参数获取厂商名（保持多窗口隔离）
// 3. 从 JSON 提取 context_window.current_usage
// 4. 计算使用百分比
// 5. 根据百分比选择进度条颜色
// 6. 输出格式化状态栏
```

### 4.3 新增常量

```javascript
// 渐变颜色常量
export const PROGRESS_COLORS = {
  safe: '\x1b[32m',    // 绿色 <50%
  warning: '\x1b[33m', // 黄色 50-80%
  danger: '\x1b[31m'   // 红色 >80%
};
```

### 4.4 新增函数

```javascript
// 根据百分比获取颜色
export function getProgressColor(percent) {
  if (percent >= 80) return PROGRESS_COLORS.danger;
  if (percent >= 50) return PROGRESS_COLORS.warning;
  return PROGRESS_COLORS.safe;
}

// 渲染进度条
export function renderProgressBar(percent, width = 10) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getProgressColor(percent);
  return `${color}${'▓'.repeat(filled)}${'░'.repeat(empty)}${RESET}`;
}

// 渲染完整状态栏
export function renderStatusBar(vendor, contextData) {
  const vendorColored = `${getVendorColor(vendor)}厂商:${formatVendor(vendor)}${RESET}`;
  const percent = calculateContextPercent(contextData);
  const bar = renderProgressBar(percent);
  return `${vendorColored} | 上下文:${percent}% ${bar}`;
}
```

## 5. 异常处理

| 场景 | 处理方式 |
|------|----------|
| JSON 解析失败 | 回退显示 `厂商:GLM` |
| `current_usage` 为 null | 显示 `上下文:0%` + 空进度条 |
| stdin 无数据 | 回退显示 `厂商:GLM` |

## 6. 兼容性

- 保持命令行参数传递厂商名（多窗口隔离）
- 新增 stdin JSON 解析（增强功能）
- 两者的结合确保功能完整性

## 7. 测试计划

1. **单元测试**：进度条渲染、颜色选择、百分比计算
2. **集成测试**：完整状态栏渲染
3. **手动测试**：实际 Claude Code 环境验证
