# Claude 配置切换启动模式设计

**日期**: 2026-02-26

## 背景与目标

**问题描述**：
当前 cs-cli 通过覆盖 `settings.json` 文件切换配置，导致：
1. 其他正在运行的 Claude Code 窗口会立即读取到新配置
2. 切换行为影响了非当前会话的进程

**目标**：
1. 每个终端窗口独立使用自己的配置
2. 多窗口同时运行不同配置互不干扰
3. `settings.json` 作为公共配置，不再被覆盖

## 设计方案

### 核心变化

利用 Claude 的 `--settings` 参数和配置合并特性：
- `settings.json` → 公共配置（主题、快捷键等）
- `settings.json.xxx` → 特定厂商配置（ApiKey、API 地址等）
- Claude 运行时自动合并两者

### switch 命令新行为

**Claude 服务**：
```bash
cs-cli switch glm

# 实际行为
1. 验证 settings.json.glm 存在且格式正确
2. 执行 claude --settings ~/.claude/settings.json.glm
3. 前台运行，继承当前终端的 stdin/stdout/stderr
4. Ctrl+C 退出 Claude
```

**Gemini/Codex 服务**（保持原行为）：
```bash
cs-cli switch prod -s gemini
# 继续使用文件覆盖方式
```

### 错误处理

| 场景 | 处理方式 |
|------|----------|
| 配置文件不存在 | 报错 + 列出可用配置 |
| 配置文件格式错误 | 报错 + 提示具体错误 |
| Claude 命令不存在 | 报错 "claude command not found" |

## 命令变化

### 移除的命令

| 命令 | 原因 |
|------|------|
| `current` | 不再有"当前配置"概念 |
| `undo` | 不再有需要撤销的全局状态 |

### list 命令简化

```bash
# 之前
cs-cli list
# Claude 配置变体:
#   * glm (current)
#     claude
#     work

# 之后
cs-cli list
# Claude 配置变体:
#   glm
#   claude
#   work
```

## 文件结构与职责

```
~/.claude/
├── settings.json           # 公共配置（主题、快捷键等），不再被覆盖
├── settings.json.glm       # GLM 厂商配置（ApiKey、API 地址等）
├── settings.json.claude    # Claude 厂商配置
├── settings.json.kimi      # Kimi 厂商配置
└── ...
```

### 配置合并示例

```json
// settings.json（公共）
{
  "theme": "dark",
  "editor.fontSize": 14
}

// settings.json.glm（特定）
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "xxx",
    "ANTHROPIC_BASE_URL": "https://glm.xxx.com"
  }
}

// Claude 运行时自动合并两者
```

## 代码修改范围

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `bin/cs-cli.js` | 移除 `current`、`undo` 命令注册 |
| `src/commands/switch.js` | Claude 服务直接启动进程 |
| `src/commands/list.js` | 移除激活状态显示 |
| `src/core/switcher.js` | 新增 `launchClaude()` 函数 |
| `src/core/services/claude.js` | 移除 state 写入逻辑 |
| `src/utils/state.js` | 简化，移除 current/current_hash |

### 可以删除的文件

| 文件 | 原因 |
|------|------|
| `src/commands/current.js` | 命令移除 |
| `src/commands/undo.js` | 命令移除 |

## 验收标准

- [ ] Claude switch 直接启动进程，前台运行
- [ ] settings.json 不再被覆盖
- [ ] 多窗口同时运行不同配置互不干扰
- [ ] `current`、`undo` 命令已移除
- [ ] `list` 无激活状态显示
- [ ] Gemini/Codex 保持原有行为

## 测试场景

| 测试场景 | 预期结果 |
|----------|----------|
| `cs-cli switch glm` | 启动 Claude，使用 settings.json.glm |
| `cs-cli switch glm` (文件不存在) | 报错 + 列出可用配置 |
| `cs-cli switch glm` (JSON 格式错误) | 报错 + 提示具体错误 |
| `cs-cli switch prod -s gemini` | 保持原行为（覆盖文件） |
| `cs-cli list` | 列出配置，无激活标记 |
| `cs-cli current` | 命令不存在 |
| `cs-cli undo` | 命令不存在 |
