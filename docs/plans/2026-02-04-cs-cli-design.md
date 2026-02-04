# cs-cli - Claude Settings Switcher 设计文档

**日期**: 2026-02-04
**版本**: 0.1.0

## 1. 项目概述

cs-cli 是一个用于管理 Claude Code 配置文件的命令行工具。通过 `settings.json.<variant>` 命名变体，实现配置的快速切换。

**核心设计原则**:
- `settings.json` 是唯一生效文件
- `settings.json.<variant>` 是候选配置
- 文件级原子替换操作
- 环境变量优先的路径配置

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| CLI 框架 | commander.js |
| TUI 框架 | ink + react |
| 样式 | chalk（彩色输出） |
| 差异展示 | diff / json-diff |
| 测试 | vitest |
| Node.js | >= 18.0.0 |

## 3. 项目结构

```
cs-cli/
├── package.json
├── README.md
├── bin/
│   └── cs-cli.js          # CLI 入口
├── src/
│   ├── core/              # 核心逻辑
│   │   ├── config.js      # 配置文件操作
│   │   ├── switcher.js    # 切换逻辑
│   │   ├── validator.js   # JSON 校验
│   │   └── backup.js      # 备份/恢复
│   ├── commands/          # 命令实现
│   │   ├── list.js
│   │   ├── switch.js
│   │   ├── current.js
│   │   ├── diff.js
│   │   ├── backup.js
│   │   ├── restore.js
│   │   └── interactive.js # TUI 入口
│   ├── ui/                # TUI 组件
│   │   ├── App.jsx        # ink 主应用
│   │   ├── ConfigList.jsx
│   │   └── DiffView.jsx
│   └── utils/
│       ├── path.js        # 路径解析
│       └── state.js       # state.json 管理
└── tests/
```

## 4. 命令清单

```bash
# 列出所有可用配置
cs-cli list

# 切换配置（核心命令）
cs-cli switch <variant>           # 切换到指定配置
cs-cli switch <variant> --dry-run # 预览切换，不实际执行

# 查看当前生效配置
cs-cli current

# 比较两个配置
cs-cli diff <variant1> <variant2> # 比较两个候选配置
cs-cli diff <variant>             # 比较候选配置与当前生效配置

# 备份与恢复
cs-cli backup                      # 手动备份当前配置
cs-cli restore [timestamp]         # 恢复备份，默认最新

# 交互式 TUI
cs-cli interactive
cs-cli ui                          # 简短别名
```

## 5. 切换流程

```
┌─────────────────────────────────────────────────────────────┐
│                    cs-cli switch zipu                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ 1. 检查目标文件是否存在   │
              │    settings.json.zipu    │
              └─────────────────────────┘
                     │ 不存在
                     ▼
              ┌─────────────────────────┐
              │ 2. JSON 语法校验         │
              │    JSON.parse()          │
              └─────────────────────────┘
                   │ 无效
                   ▼
              ┌─────────────────────────┐
              │ 3. 备份当前配置           │
              │    backups/*.bak         │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ 4. 原子替换               │
              │    Copy-Item -Force       │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ 5. 更新 state.json       │
              │    {current: "zipu"}     │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ 6. 输出成功信息           │
              │    ✓ Switched to zipu    │
              └─────────────────────────┘
```

## 6. 状态管理 (state.json)

```json
{
  "current": "zipu",
  "current_hash": "a1b2c3d4",
  "last_switch": "2026-02-04T10:23:00.000Z",
  "history": [
    {"variant": "default", "switched_at": "2026-02-04T09:00:00.000Z"},
    {"variant": "zipu", "switched_at": "2026-02-04T10:23:00.000Z"}
  ]
}
```

## 7. TUI 界面

```
┌────────────────────────────────────────────────────────────┐
│  ▲ Claude Settings Switcher                   [q: quit]    │
│  ───────────────────────────────────────────────────────────│
│                                                              │
│  Available Configurations                                   │
│                                                              │
│    ▸ default (● active)                                     │
│      openai                                                 │
│      zipu                                                   │
│      anthropic                                              │
│      local                                                  │
│                                                              │
│  ────────────────────────────────────────────────────────── │
│                                                              │
│  Diff Preview                                               │
│                                                              │
│    --- settings.json          +++ settings.json.zipu         │
│    "model": "claude-3-5-sonnet"  "model": "gpt-4o"         │
│                                                              │
│  [Switch]  [Refresh]  [Backup]                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 键盘快捷键

| 按键 | 操作 |
|------|------|
| ↑/↓ | 选择配置 |
| Enter | 确认切换 |
| d | 切换 diff 视图 |
| r | 刷新列表 |
| b | 创建备份 |
| q / Esc | 退出 |

## 8. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 目标文件不存在 | 列出可用配置，提示正确名称 |
| JSON 语法错误 | 显示解析错误位置和原因 |
| 备份目录创建失败 | 中止切换，提示权限问题 |
| 写入失败 | 保留原文件，显示详细错误 |
| 配置目录不存在 | 提示用户创建或指定路径 |

## 9. 路径解析逻辑

```
1. 检查环境变量 CLAUDE_CONFIG_DIR
2. 若未设置，使用默认路径：
   - Windows: %USERPROFILE%\.claude
   - macOS/Linux: ~/.claude
3. 验证目录存在性，不存在则提示用户
```

## 10. 配置命名规范

```
settings.json.<variant>

<variant>: 供应商 / 模型族 / 场景名

示例:
  settings.json.default
  settings.json.openai
  settings.json.zipu
  settings.json.anthropic
  settings.json.local

禁止点号嵌套（避免 settings.json.a.b）
```
