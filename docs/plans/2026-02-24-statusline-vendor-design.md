# StatusLine 厂商显示功能设计文档

**日期**: 2026-02-24
**版本**: 0.1.0

## 1. 功能概述

在 Claude Code 状态栏显示当前窗口使用的模型厂商名称，使用不同颜色区分不同厂商。

### 核心需求

- 状态栏只显示厂商名称（如 `GLM`、`KIMI`、`MINIMAX`）
- 每个厂商使用不同的颜色
- 多窗口隔离：每个窗口显示其启动时使用的厂商，不受其他窗口切换影响

## 2. 技术方案

### 2.1 命令行参数传递

在 `statusLine.command` 中硬编码厂商名：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"D:/develop/java/source/code-cli-switch/bin/statusline.js\" glm",
    "padding": 0
  }
}
```

这样可以确保每个窗口的状态栏显示其启动时的厂商，不会因为其他窗口切换而改变。

### 2.2 文件变更清单

```
新增文件:
├── bin/statusline.js          # 状态栏脚本，接收厂商名作为参数
├── src/core/statusline.js     # 状态栏核心逻辑（颜色映射等）

修改文件:
├── src/core/switcher.js       # 切换时注入 statusLine 配置
```

## 3. 厂商颜色映射

```javascript
const vendorColors = {
  // 国内大模型
  'glm': '\x1b[38;5;46m',      // 亮绿色 - 智谱 GLM
  'kimi': '\x1b[38;5;51m',     // 青色 - 月之暗面
  'minimax': '\x1b[38;5;220m', // 金色 - MiniMax
  'deepseek': '\x1b[38;5;33m', // 蓝色 - DeepSeek
  'qwen': '\x1b[38;5;209m',    // 橙色 - 通义千问

  // 国际大模型
  'claude': '\x1b[38;5;175m',  // 粉紫色 - Anthropic
  'openai': '\x1b[38;5;76m',   // 绿色 - OpenAI
  'gemini': '\x1b[38;5;81m',   // 天蓝色 - Google

  // 其他
  'default': '\x1b[38;5;246m'  // 灰色 - 未知厂商
};
```

## 4. 工作流程

```
用户执行 cs-cli switch glm
        │
        ▼
复制 settings.json.glm → settings.json
        │
        ▼
注入 statusLine 配置（命令中硬编码 glm）
        │
        ▼
更新 .cs-state.json
        │
        ▼
Claude Code 启动时执行 statusLine 命令
        │
        ▼
显示: GLM (亮绿色)
```

## 5. 多窗口场景

| 窗口 | 操作 | 状态栏显示 |
|------|------|-----------|
| 窗口 A | 启动时使用 GLM | GLM (绿色) |
| 窗口 B | 切换到 MINIMAX | MINIMAX (金色) |
| 窗口 A | （仍在运行） | GLM (绿色) - 不受影响 |

## 6. 实现细节

### 6.1 bin/statusline.js

```javascript
#!/usr/bin/env node
import { getVendorColor, formatVendor } from '../src/core/statusline.js';

const vendor = process.argv[2] || 'unknown';
const color = getVendorColor(vendor);
const reset = '\x1b[0m';

console.log(`${color}${formatVendor(vendor)}${reset}`);
```

### 6.2 src/core/statusline.js

提供颜色映射和格式化函数：
- `getVendorColor(vendor)` - 获取厂商对应的 ANSI 颜色码
- `formatVendor(vendor)` - 格式化厂商名（大写）
- `injectStatusLine(filePath, vendor)` - 向 settings.json 注入 statusLine 配置

### 6.3 src/core/switcher.js 修改

在 `switchConfig` 函数中，原子替换后添加注入逻辑：

```javascript
// 4. 原子替换
isolatedOperation(service, (workDir) => {
  // ... 现有复制逻辑 ...
  atomicSwitch(tempPath, targetPath);
});

// 5. 注入 statusLine 配置 (新增)
if (service === 'claude') {
  injectStatusLine(targetPath, variant);
}

// 6. 计算哈希并更新状态
// ... 现有逻辑 ...
```

## 7. 测试计划

1. **单元测试**：颜色映射函数
2. **集成测试**：切换后检查 statusLine 配置是否正确注入
3. **手动测试**：
   - 切换到不同厂商，验证状态栏颜色
   - 多窗口场景验证隔离性

## 8. 后续扩展

- [ ] 支持用户自定义颜色映射
- [ ] 支持 Gemini、Codex 等其他 CLI 工具
- [ ] 添加 `cs-cli statusline --setup` 命令手动配置
