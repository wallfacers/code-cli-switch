# Claude Code 配置文件隔离设计方案 v2

## 背景与目标

**问题描述**：
当前 cs-cli 切换配置时，直接替换 `~/.claude/settings.json` 文件。这导致：
1. 其他正在运行的 Claude Code 窗口会立即读取到新配置
2. 切换行为影响了非当前会话的进程

**目标**：
1. 切换配置后仅当前终端会话生效（通过 `eval` 执行）
2. 其他已运行的 Claude Code 窗口不受影响
3. 新启动的终端会话使用最新的配置（通过持久化到 shell 配置）
4. 已运行的终端保持原有配置

## 方案概述

采用**环境变量 + profiles 目录**方案：
- 配置文件存储在 `~/.claude/profiles/{variant}/settings.json`
- 切换时输出 `export CLAUDE_CONFIG_DIR=...` 供 `eval` 执行
- 自动持久化到 shell 配置文件（~/.zshrc、~/.bashrc 等）
- 不再修改全局 `~/.claude/settings.json`

## 详细设计

### 1. 目录结构

```
~/.claude/
├── settings.json              # 保留作为全局回退（可选）
├── profiles/                  # 配置 profiles 目录
│   ├── glm/
│   │   └── settings.json      # glm 配置
│   ├── claude/
│   │   └── settings.json      # claude 配置
│   ├── work/
│   │   └── settings.json      # work 配置
│   └── ...
├── backups/                   # 备份目录（保持不变）
└── hooks/                     # hooks 目录（保持不变）
```

**说明**：
- 每个 profile 是一个独立目录，包含 `settings.json`
- 现有的 `settings.json.{variant}` 文件在切换时自动迁移

### 2. 切换流程

```
用户执行: eval "$(cs-cli switch glm)"
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  1. 检查 profiles/glm/settings.json 是否存在         │
│     - 存在 → 直接使用                                │
│     - 不存在 → 检查 settings.json.glm                │
│       - 存在 → 自动迁移到 profiles/glm/              │
│       - 不存在 → 报错退出                            │
└─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  2. 验证配置文件格式 (JSON 校验)                       │
└─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  3. 注入 statusLine 配置到 profile                   │
│     (修改 profiles/glm/settings.json)               │
└─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  4. 更新 shell 配置文件                               │
│     - 写入: export CLAUDE_CONFIG_DIR=...            │
│     - 使用标记区间，方便更新时替换                      │
└─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  5. 输出 shell 命令（供 eval 执行）                    │
│     - Unix: export CLAUDE_CONFIG_DIR="..."          │
│     - PowerShell: $env:CLAUDE_CONFIG_DIR = "..."    │
└─────────────────────────────────────────────────────┘
```

**关键变化**：
- **不再修改** `~/.claude/settings.json`
- 只操作 `profiles/{variant}/settings.json`
- 输出环境变量命令供 `eval` 执行

### 3. Shell 配置持久化

#### Unix (macOS/Linux)

**检测当前 shell**：
```bash
# 根据 $SHELL 环境变量判断
zsh  → ~/.zshrc
bash → ~/.bashrc
```

**写入方式**：
```bash
# 使用唯一标记，方便更新时替换
# cs-cli-auto-start
export CLAUDE_CONFIG_DIR="$HOME/.claude/profiles/glm"
# cs-cli-auto-end
```

**更新逻辑**：
- 如果存在标记区间 → 替换区间内容
- 如果不存在 → 追加到文件末尾

#### Windows

| Shell | 配置文件 | 环境变量语法 |
|-------|---------|-------------|
| PowerShell | `$PROFILE` | `$env:CLAUDE_CONFIG_DIR = "..."` |
| CMD | 用户环境变量（通过 `setx`） | `setx CLAUDE_CONFIG_DIR "..."` |
| Git Bash | `~/.bashrc` | 同 Unix |

### 4. 配置迁移

#### 触发时机

切换时按需触发：
- `profiles/{variant}/` 不存在
- 但 `settings.json.{variant}` 存在

#### 迁移流程

```
迁移前:
~/.claude/
├── settings.json
├── settings.json.glm
└── settings.json.claude

迁移后 (执行 cs-cli switch glm):
~/.claude/
├── settings.json              # 保留原样
├── profiles/
│   └── glm/
│       └── settings.json      # 从 settings.json.glm 复制
├── settings.json.glm          # 保留原样（不删除）
└── settings.json.claude       # 保留原样
```

#### 迁移原则

| 原则 | 说明 |
|------|------|
| **只复制，不删除** | 保留原有文件，避免数据丢失 |
| **按需迁移** | 只迁移当前切换的目标 variant |
| **静默执行** | 迁移过程不提示，除非出错 |

### 5. 命令行为

#### switch 命令

**使用方式**：
```bash
eval "$(cs-cli switch glm)"
```

**成功时输出**：
```bash
export CLAUDE_CONFIG_DIR="$HOME/.claude/profiles/glm"
```

**失败时输出**（stderr）：
```bash
Error: Configuration variant "xxx" not found

Available variants:
  - glm
  - claude
  - work
```

#### list 命令

保持原有风格，扫描 `profiles/` + `settings.json.*` 合并显示：
```
Available variants:
  * glm (current)
    claude
    work
```

### 6. 兼容性

| 场景 | 处理方式 |
|------|---------|
| `profiles/glm/` 存在 | 使用 profiles 目录 |
| `profiles/glm/` 不存在，但 `settings.json.glm` 存在 | 自动迁移后使用 |
| 两者都不存在 | 报错提示找不到配置 |

### 7. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 目标配置不存在 | 报错 + 列出可用配置 |
| 配置文件 JSON 格式错误 | 报错 + 提示具体错误位置 |
| shell 配置文件写入失败 | 警告 + 切换仍然成功 |
| 迁移失败 | 报错 + 不继续切换 |

### 8. Windows 检测逻辑

| 检测方式 | Shell 类型 | 输出格式 |
|---------|-----------|---------|
| `$PSHOME` 或 PWD 路径含 `PowerShell` | PowerShell | `$env:CLAUDE_CONFIG_DIR = "..."` |
| `%COMSPEC%` 含 `cmd.exe` | CMD | `set CLAUDE_CONFIG_DIR=...` |
| 其他 | Unix-like (Git Bash) | `export CLAUDE_CONFIG_DIR="..."` |

## 验收标准

- [ ] `eval "$(cs-cli switch glm)"` 后当前会话使用新配置
- [ ] 其他已运行的 Claude Code 窗口不受影响
- [ ] 新终端自动使用最新配置（通过 shell 配置持久化）
- [ ] 首次切换时自动迁移现有配置
- [ ] 命令输出风格保持不变
- [ ] Windows PowerShell/CMD 完全支持
