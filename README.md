# cs-cli

多编码工具 CLI 配置切换工具 - 用于快速切换不同编码工具的配置文件。

![效果图](效果图.png)

## 功能特性

- **多工具支持** - Claude (JSON)、Gemini (ENV)、Codex (TOML)
- **快速切换** - 在多个配置变体之间一键切换
- **交互式选择** - 无参数运行时的简洁选择界面
- **配置比较** - 比较不同配置之间的差异
- **备份恢复** - 自动备份和手动恢复功能
- **审计日志** - 记录所有配置操作历史
- **Shell 补全** - 支持 Bash、Zsh、PowerShell、Fish
- **跨平台** - 支持 Windows、macOS、Linux
- **国际化** - 支持中文/英文界面（默认中文）

## 安装

```bash
# 安装依赖并全局链接
npm install
npm install -g .
```

或使用 npx（无需安装）：

```bash
npx cs-cli
```

## 快速开始

### 交互式模式

直接运行 `cs-cli`，先选择编码工具，再选择配置：

```bash
cs-cli
```

```
选择编码工具:
  claude  - Claude
  gemini  - Gemini
  codex   - Codex

Gemini 配置变体:
  prod
  dev
  test
```

### 命令行模式

```bash
# 切换 Claude 配置（默认）
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

## 命令参考

### 查看配置

```bash
# 查看帮助
cs-cli --help
cs-cli <command> -h

# 列出所有编码工具的配置概览
cs-cli list
cs-cli ls              # 简短别名

# 列出指定编码工具的配置
cs-cli list -s claude
cs-cli list -s gemini
```

### 切换配置

```bash
# 切换 Claude 配置（启动 Claude 进程）
cs-cli switch openai
cs-cli sw openai       # 简短别名

# 指定编码工具
cs-cli switch prod -s gemini   # Gemini: 覆盖配置文件
cs-cli switch local -s codex   # Codex: 覆盖配置文件

# 预览切换（不实际执行）
cs-cli switch openai --dry-run

# 切换时不创建备份
cs-cli switch openai --no-backup
```

**切换行为说明：**

| 工具 | 行为 |
|------|------|
| Claude | 使用 `--settings` 标志启动 Claude 进程，不修改原配置文件 |
| Gemini | 将选中的配置变体复制到 `.env` 文件 |
| Codex | 将选中的配置变体复制到 `config.toml` 文件 |

### 比较配置

```bash
# 比较默认配置与指定配置
cs-cli diff openai

# 比较两个配置
cs-cli diff openai anthropic

# 比较其他编码工具
cs-cli diff prod -s gemini
```

### 备份与恢复

```bash
# 创建备份
cs-cli backup
cs-cli backup -s gemini
cs-cli backup --list   # 列出所有备份

# 恢复备份
cs-cli restore                    # 恢复最新
cs-cli restore 20260204102300     # 恢复指定备份
cs-cli restore -s gemini
```

### 系统工具

```bash
# 初始化配置目录
cs-cli init claude
cs-cli init gemini

# 安装 ConfigChange hook
cs-cli install-hook

# 生成 Shell 补全脚本
cs-cli completion bash
cs-cli completion bash --install
cs-cli completion zsh

# 查看审计日志
cs-cli audit
cs-cli audit -s claude
cs-cli audit -n 50
```

## StatusLine 状态栏

cs-cli 为 Claude Code 提供自定义状态栏脚本，在底部状态栏实时显示当前厂商、模型名称、工作目录、运行状态和上下文用量。

### 显示效果

```
CC: Claude Sonnet 4.5 | context: ●●●●●●●●○○○ 74% | ● thinking | my-project (master)
```

各模块说明（从左到右）：

| 顺序 | 示例 | 说明 |
|------|------|------|
| 厂商: 模型名 | `CC: Claude Sonnet 4.5` | 厂商用对应颜色高亮，模型名自动格式化 |
| 上下文进度条 | `context: ●●●●●●●●○○○ 74%` | 颜色随用量变化，无数据时省略 |
| 运行状态 | `● thinking` | 灰色，来自 Claude Code 实时状态，无状态时省略 |
| 目录 (分支) | `my-project (master)` | 目录名青色，分支名亮绿色，无 cwd 时省略 |

无上下文数据时回退为仅显示厂商名称。

### 配置方法

在对应的 `settings.json.<variant>` 文件中添加 `statusLine` 字段：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/path/to/cs-cli/bin/statusline.js\" cc",
    "padding": 1
  }
}
```

将 `cc` 替换为实际厂商名（见下方厂商列表），将路径替换为 cs-cli 的实际安装路径。

**使用 cs-cli 自动注入（推荐）：**

cs-cli 内部通过 `injectStatusLine` 函数在切换配置时自动向 `settings.json` 写入上述配置，无需手动编辑。

### 厂商与颜色

| 厂商标识 | 显示名 | 颜色 |
|---------|--------|------|
| `claude` | CLAUDE | 粉紫色 |
| `cc` | CC | 洋红色 |
| `openai` | OPENAI | 绿色 |
| `gemini` | GEMINI | 天蓝色 |
| `glm` | GLM | 亮绿色 |
| `kimi` | KIMI | 青色 |
| `deepseek` | DEEPSEEK | 蓝色 |
| `qwen` | QWEN | 橙色 |
| `minimax` | MINIMAX | 金色 |
| `duckcoding` | DUCKCODING | 紫色 |
| 其他 | 大写原值 | 灰色 |

### 上下文进度条颜色

进度条颜色（`●●●○○○○○○○○`）随上下文用量动态变化：

| 用量 | 颜色 |
|------|------|
| < 50% | 绿色 |
| 50–79% | 黄色 |
| ≥ 80% | 红色 |

### Claude Code 传入的 JSON 数据

Claude Code 通过 stdin 向脚本传递以下 JSON 结构：

```json
{
  "model": { "display_name": "Claude Sonnet 4.5" },
  "cwd": "/path/to/project",
  "status": "thinking",
  "context_window": {
    "context_window_size": 200000,
    "current_usage": {
      "input_tokens": 50000,
      "cache_creation_input_tokens": 10000,
      "cache_read_input_tokens": 5000
    }
  }
}
```

脚本从命令行参数读取厂商标识，从 stdin 读取上述 JSON，厂商标识用于决定颜色，其余字段用于构建状态栏内容。

## 配置

### 语言设置

```bash
# 中文（默认）
export CS_CLI_LANG=zh

# 英文
export CS_CLI_LANG=en
```

### 配置路径

配置目录按以下规则查找：

| 系统 | 路径 |
|------|------|
| Windows | `%USERPROFILE%\.claude` / `%USERPROFILE%\.gemini` / `%USERPROFILE%\.codex` |
| macOS/Linux | `~/.claude` / `~/.gemini` / `~/.codex` |

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
