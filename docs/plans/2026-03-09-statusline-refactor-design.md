# StatusLine 重构设计文档

**日期**: 2026-03-09

## 1. 目标

将 statusline 从单行输出重构为双行 TUI 布局，同时保留厂商（vendor）显示功能。

## 2. 最终输出格式

```
CC: Opus 4.6 | keynote (main*) | ● thinking
context   ●●●○○○○○○○○ 28%
```

### Row 1（状态与环境信息）
| 模块 | 内容 | 颜色 | 来源 |
|------|------|------|------|
| A | `CC: Opus 4.6` | 厂商色（现有 VENDOR_COLORS） | CLI 参数(vendor) + stdin `model` |
| sep | ` \| ` | Dim/灰色 | — |
| B | `keynote (main*)` | cyan(目录) + green(分支) | stdin `cwd` |
| sep | ` \| ` | Dim/灰色 | — |
| C | `● thinking` | Dim/灰色 | stdin `status` |

- 无分支时省略分支部分
- 无 status 时省略模块 C

### Row 2（上下文进度）
| 模块 | 内容 | 颜色 | 来源 |
|------|------|------|------|
| A | `context` | 默认前景色（白） | 固定文本 |
| B | `●●●○○○○○○○○ 28%` | 绿/黄/红（按用量） | stdin `context_window` |

- 进度条字符：`●`（实心）和 `○`（空心），宽度 11 格
- 无 contextData 时仅输出 Row 1

## 3. 数据层

### stdin JSON 新增字段
```json
{
  "context_window": { ... },
  "cwd": "/path/to/project",
  "model": "claude-opus-4-6",
  "status": "thinking"
}
```

### 新增辅助函数

#### `parseModelName(modelStr)`
将原始模型 ID 转为简短显示名：
- `claude-opus-4-6` → `Opus 4.6`
- `claude-sonnet-4-5` → `Sonnet 4.5`
- `gpt-4o` → `GPT-4o`
- 未知格式：直接返回原值

#### `renderStatus(status)`
将状态字符串转为带圆点的显示文本：
- `"thinking"` → `● thinking`
- `"idle"` → `● idle`
- `null/undefined` → `● active`
- 颜色：Dim/灰色

## 4. 渲染层

### 新增行级函数

```js
renderRow1(vendor, model, cwd, status) → string
renderRow2(contextData) → string
```

### `renderStatusBar` 签名变更

```js
// 旧
renderStatusBar(vendor, contextData, cwd)

// 新
renderStatusBar(vendor, contextData, cwd, model, status)
```

返回值：`renderRow1(...) + "\n" + renderRow2(...)`

无 contextData 时回退为仅输出 Row 1（等同现有 renderVendor 行为）。

### 进度条字符变更

```js
// 旧
'▓'.repeat(filled) + '░'.repeat(empty)

// 新
'●'.repeat(filled) + '○'.repeat(empty)
```

## 5. 调用方变更

### `bin/statusline.js`
```js
model  = parsed.model  || null;   // 新增读取
status = parsed.status || null;   // 新增读取

renderStatusBar(vendor, contextData, cwd, model, status)  // 新签名
```

CLI 参数格式**不变**：`node statusline.js <vendor>`

### 无需变更
- `generateStatusLineConfig` — 命令格式不变
- `injectStatusLine` — 无变更
- `renderVendor` — 无变更（回退路径保留）

## 6. 测试变更

- 更新 `renderStatusBar` 的调用签名（补充新参数）
- 新增 `parseModelName` 单元测试
- 新增 `renderStatus` 单元测试
- 新增双行输出格式验证
