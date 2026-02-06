# cs-cli

多编码工具 CLI 配置切换工具 - 用于快速切换不同编码工具的配置文件。

支持 Claude (JSON)、Gemini (ENV)、Codex (TOML) 等多种配置格式。

## 为什么需要这个工具？

在同一个 Windows 窗口中，通过多开 PowerShell 实现多账号/多配置同时运行，每个 PowerShell 窗口使用不同的配置。

通过 cs-cli 可以在不同编码工具、不同配置之间快速切换，配合多窗口实现多账号并行工作。

![效果图](效果图.png)

## 功能特性

- **多编码工具支持**: Claude (JSON)、Gemini (ENV)、Codex (TOML)
- **快速切换**: 在多个配置变体之间快速切换
- **交互式选择**: 无参数运行时的简洁选择界面
- **配置比较**: 比较不同配置之间的差异
- **备份恢复**: 自动备份和手动恢复功能
- **跨平台**: 支持 Windows、macOS、Linux
- **国际化**: 支持中文/英文界面（默认中文）

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

直接运行 `cs-cli`，先选择编码工具，再选择配置：

```bash
cs-cli
```

```
选择编码工具:
  duckcoding - DuckCoding
  gemini     - Gemini
```

选择编码工具后，显示该编码工具的配置列表：

```
Gemini 配置变体:

  duckcoding
  google
```

### 方式二：命令行直接切换

```bash
# 切换 Claude 配置（默认编码工具）
cs-cli switch openai

# 切换 Gemini 配置
cs-cli switch prod -s gemini

# 切换 Codex 配置
cs-cli switch local -s codex
```

## 支持的编码工具

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
# 列出所有编码工具的概览
cs-cli list
cs-cli ls              # 简短别名

# 列出指定编码工具的配置
cs-cli list -s claude
cs-cli list -s gemini
cs-cli list -s codex

# 列出所有编码工具的详细配置
cs-cli list --all
```

### 切换配置

```bash
# 切换 Claude 配置（默认编码工具）
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
# 查看所有编码工具的当前配置概览
cs-cli current

# 查看指定编码工具的当前配置
cs-cli current -s claude
cs-cli current -s gemini

# 查看所有编码工具的详细当前配置
cs-cli current --all
```

### 比较配置

```bash
# 比较当前配置与指定配置（Claude）
cs-cli diff openai

# 比较两个配置
cs-cli diff openai anthropic

# 比较其他编码工具的配置
cs-cli diff prod -s gemini
cs-cli diff local remote -s codex
```

### 备份与恢复

```bash
# 创建 Claude 配置备份
cs-cli backup

# 创建其他编码工具的备份
cs-cli backup -s gemini
cs-cli backup -s codex

# 创建备份并列出所有备份
cs-cli backup --list

# 恢复最新备份
cs-cli restore

# 恢复指定编码工具的最新备份
cs-cli restore -s gemini

# 恢复指定备份
cs-cli restore 20260204102300
cs-cli restore 20260204102300 -s gemini
```

## 新增命令

### init - 初始化配置

```bash
cs-cli init claude
```

交互式初始化向导，帮助创建配置目录和示例文件。支持 Claude、Gemini、Codex 等服务。

### undo - 撤销切换

```bash
cs-cli undo
cs-cli undo -s gemini
```

撤销最后一次切换操作，自动恢复到上一个配置。

### completion - Shell 补全

```bash
# 生成补全脚本
cs-cli completion bash

# 安装补全脚本
cs-cli completion bash --install
```

生成 Bash、Zsh、PowerShell、Fish 的自动补全脚本。

### audit - 审计日志

```bash
# 查看最近 10 条操作
cs-cli audit

# 过滤特定服务
cs-cli audit -s claude

# 查看更多条目
cs-cli audit -n 50
```

查看所有配置切换、备份、恢复操作的审计日志。

## 改进功能

### 并发安全
使用进程隔离和原子操作，支持多终端同时切换配置而不会冲突。

### 语义验证
切换前自动验证配置文件的语义正确性，确保 api_key 等必需字段存在。

### 交互式恢复
恢复备份时提供交互式选择列表，显示相对时间（如"5m ago"）。

## 配置路径

工具按以下优先级查找配置目录：

1. 环境变量 `<CODING_TOOL>_CONFIG_DIR`
2. 默认路径：
   - Windows: `%USERPROFILE%\.\<coding_tool>`
   - macOS/Linux: `~/.<coding_tool>`

### 环境变量

```bash
# Claude 配置目录
export CLAUDE_CONFIG_DIR=/custom/path

# Gemini 配置目录
export GEMINI_CONFIG_DIR=/custom/path

# Codex 配置目录
export CODEX_CONFIG_DIR=/custom/path
```

## 语言设置

通过环境变量设置界面语言：

```bash
# 中文（默认）
export CS_CLI_LANG=zh

# 英文
export CS_CLI_LANG=en
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
