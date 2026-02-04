# cs-cli

Multi-service CLI configuration switcher - 一个用于管理多个服务配置文件的命令行工具。

支持 Claude (JSON)、Gemini (ENV)、Codex (TOML) 等多种配置格式。

## 为什么需要这个工具？

在同一个 Windows 窗口中，通过多开 PowerShell 实现多账号/多配置同时运行，每个 PowerShell 窗口使用不同的配置。

通过 cs-cli 可以在不同服务、不同配置之间快速切换，配合多窗口实现多账号并行工作。

## 功能特性

- **多服务支持**: Claude (JSON)、Gemini (ENV)、Codex (TOML)
- **快速切换**: 在多个配置变体之间快速切换
- **交互式选择**: 先选厂商，再选配置的两级选择
- **配置比较**: 比较不同配置之间的差异
- **备份恢复**: 自动备份和手动恢复功能
- **跨平台**: 支持 Windows、macOS、Linux

## 安装

```bash
# 安装依赖
npm install

# 全局链接本地包
npm install -g .
```

或使用 npx（无需安装）：

```bash
npx cs-cli
```

## 快速开始

### 方式一：交互式选择（推荐）

直接运行 `cs-cli`，先选择服务，再选择配置：

```bash
cs-cli
```

```
Select service:
Use ↑/↓ to select, Enter to confirm, q to quit

▸ claude    - Claude
  gemini    - Gemini
  codex     - Codex
```

选择服务后，显示该服务的配置列表：

```
Claude Configurations:
Use ↑/↓ to select, Enter to confirm, Esc to back, q to quit

▸ openai
  local
  anthropic
```

### 方式二：命令行直接切换

```bash
# 切换 Claude 配置（默认服务）
cs-cli switch openai

# 切换 Gemini 配置
cs-cli switch prod -s gemini

# 切换 Codex 配置
cs-cli switch local -s codex
```

## 支持的服务

### Claude (JSON 格式)

```
~/.claude/
├── settings.json           # 当前生效的配置
├── settings.json.default   # 默认配置
├── settings.json.openai    # OpenAI 配置
└── settings.json.local     # 本地模型配置
```

### Gemini (ENV 格式)

```
~/.gemini/
├── .env          # 当前生效的配置
├── .env.prod     # 生产环境配置
├── .env.dev      # 开发环境配置
└── .env.test     # 测试环境配置
```

### Codex (TOML 格式)

```
~/.codex/
├── config.toml           # 当前生效的配置
├── config.toml.default   # 默认配置
├── config.toml.local     # 本地配置
└── config.toml.remote    # 远程配置
```

## 命令使用

### 查看帮助

```bash
cs-cli --help          # 查看主帮助
cs-cli <command> -h    # 查看子命令帮助
```

### 列出配置

```bash
# 列出所有服务的概览
cs-cli list
cs-cli ls              # 简短别名

# 列出指定服务的配置
cs-cli list -s claude
cs-cli list -s gemini
cs-cli list -s codex

# 列出所有服务的详细配置
cs-cli list --all
```

### 切换配置

```bash
# 切换 Claude 配置（默认服务）
cs-cli switch openai
cs-cli sw openai       # 简短别名

# 切换 Gemini 配置
cs-cli switch prod -s gemini

# 切换 Codex 配置
cs-cli switch local -s codex

# 预览切换（不实际执行）
cs-cli switch openai --dry-run

# 切换时不创建备份
cs-cli switch openai --no-backup
```

### 查看当前配置

```bash
# 查看所有服务的当前配置概览
cs-cli current

# 查看指定服务的当前配置
cs-cli current -s claude
cs-cli current -s gemini

# 查看所有服务的详细当前配置
cs-cli current --all
```

### 比较配置

```bash
# 比较当前配置与指定配置（Claude）
cs-cli diff openai

# 比较两个配置
cs-cli diff openai anthropic

# 比较其他服务的配置
cs-cli diff prod -s gemini
cs-cli diff local remote -s codex
```

### 备份与恢复

```bash
# 创建 Claude 配置备份
cs-cli backup

# 创建其他服务的备份
cs-cli backup -s gemini
cs-cli backup -s codex

# 创建备份并列出所有备份
cs-cli backup --list

# 恢复最新备份
cs-cli restore

# 恢复指定服务的最新备份
cs-cli restore -s gemini

# 恢复指定备份
cs-cli restore 20260204102300
cs-cli restore 20260204102300 -s gemini
```

### 交互式 TUI

```bash
cs-cli interactive
cs-cli ui              # 简短别名
cs-cli tui             # 另一个别名
```

#### TUI 快捷键

| 按键 | 操作 |
|------|------|
| ↑/↓ 或 j/k | 选择服务/配置 |
| Enter | 确认选择/切换 |
| Esc | 返回上级（配置选择时返回服务选择） |
| d | 切换差异视图 |
| r | 刷新列表 |
| b | 创建备份 |
| q | 退出 |

## 配置路径

工具按以下优先级查找配置目录：

1. 命令行参数 `--config-dir` 或 `-c`
2. 环境变量 `<SERVICE>_CONFIG_DIR`
3. 默认路径：
   - Windows: `%USERPROFILE%\.\<service>`
   - macOS/Linux: `~/.<service>`

### 环境变量

```bash
# Claude 配置目录
export CLAUDE_CONFIG_DIR=/custom/path

# Gemini 配置目录
export GEMINI_CONFIG_DIR=/custom/path

# Codex 配置目录
export CODEX_CONFIG_DIR=/custom/path
```

## 开发

```bash
# 克隆项目
git clone <repo-url>
cd cs-cli

# 安装依赖
npm install

# 本地测试
npm link
cs-cli list

# 运行测试
npm test
```

## 许可证

MIT
