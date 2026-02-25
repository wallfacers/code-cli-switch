# Claude Code 配置文件隔离设计方案

## 背景与目标

**问题描述**：
当前 cs-cli 切换配置时，直接替换 `~/.claude/settings.json` 文件。这导致：
1. 其他正在运行的 Claude Code 窗口会立即读取到新配置
2. 切换行为影响了非当前会话的进程

**目标**：
1. 切换配置后仅当前终端会话及子进程生效
2. 其他已运行的 Claude Code 窗口不受影响
3. 新启动的终端会话使用最新的配置
4. 已运行的终端保持原有配置

## 方案概述

采用**独立配置目录 + 环境变量**方案：
- 为每个配置变体创建独立的配置目录
- 切换时设置 `CLAUDE_CONFIG_DIR` 环境变量
- 当前会话及子进程使用环境变量指向的目录
- 其他已运行的进程不受影响

## 详细设计

### 1. 目录结构

```
~/.claude/
├── settings.json           # 全局默认配置（可选，用于无环境变量时的回退）
├── profiles/
│   ├── default/
│   │   ├── settings.json
│   │   └── hooks/         # 如果需要完整隔离
│   ├── work/
│   │   └── settings.json
│   ├── personal/
│   │   └── settings.json
│   └── ...
└── current -> profiles/work  # 符号链接，指向当前激活的配置（可选）
```

### 2. 配置目录结构

每个配置变体目录包含：
- `settings.json` - Claude Code 主配置文件

可选（用于完整隔离）：
- `hooks/` - 钩子脚本目录
- `project-settings.json` - 项目级配置

### 3. 切换流程

#### 3.1 首次切换（需要迁移）

```
1. 检测到 profiles/ 目录不存在
2. 创建 ~/.claude/profiles/default/ 目录
3. 将现有的 ~/.claude/settings.json 复制到 profiles/default/settings.json
4. 创建新的配置变体目录（如 profiles/work/）
5. 将新的 settings.json.{variant} 复制到对应目录
6. 设置环境变量 CLAUDE_CONFIG_DIR=~/.claude/profiles/work
7. 在当前 shell 会话中导出环境变量
```

#### 3.2 后续切换

```
1. 用户执行 cs-cli switch work
2. 验证目标配置文件存在（profiles/work/settings.json）
3. 设置环境变量 CLAUDE_CONFIG_DIR=~/.claude/profiles/work
4. 输出切换成功的提示信息，包含环境变量设置命令
5. 可选：在 .zshrc/.bashrc 中追加配置以持久化
```

### 4. 环境变量处理

#### 4.1 设置环境变量

切换时，输出以下信息：
```
✓ 已切换到 "work" 配置
To apply immediately, run:
  export CLAUDE_CONFIG_DIR=~/.claude/profiles/work

To make it permanent, add the following to your shell config:
  echo 'export CLAUDE_CONFIG_DIR=~/.claude/profiles/work' >> ~/.zshrc
```

#### 4.2 读取优先级

Claude Code 配置目录优先级：
1. `CLAUDE_CONFIG_DIR` 环境变量（最高优先级）
2. `~/.claude/` 目录（默认）

### 5. 适配器修改

#### ClaudeAdapter 需要修改的方法

1. `getConfigDir()` - 优先检查 `CLAUDE_CONFIG_DIR` 环境变量
2. `getVariantPath(variant)` - 调整为 `~/.claude/profiles/{variant}/settings.json`
3. 需要新增 `initProfiles()` - 初始化 profiles 目录结构
4. 需要新增 `migrateToProfiles()` - 将现有配置迁移到 profiles 目录
5. 需要新增 `getProfilesDir()` - 获取 profiles 目录路径

### 6. 切换命令修改

#### 6.1 switch 命令

```javascript
// 修改 switcher.js
export function switchConfig(service, variant, options = {}) {
  // ... 现有验证逻辑 ...

  // 检查是否需要迁移
  if (!profilesInitialized()) {
    migrateToProfiles();
  }

  // 切换到新的配置目录
  const profileDir = getProfilePath(variant);

  // 设置环境变量
  process.env.CLAUDE_CONFIG_DIR = profileDir;

  // ... 其余逻辑保持不变 ...
}
```

#### 6.2 输出增强

切换成功后，输出详细的指导信息：
- 当前环境变量值
- 如何持久化到 shell 配置
- 如何验证切换成功

### 7. 新增命令

#### 7.1 profiles 命令（可选）

```bash
# 列出所有配置profile
cs-cli profiles list

# 显示当前激活的profile
cs-cli profiles current

# 创建新的profile（基于现有配置）
cs-cli profiles create <name> [--from <source>]

# 删除profile
cs-cli profiles delete <name>
```

### 8. 数据流

```
用户执行 cs-cli switch work
       ↓
检查 profiles/ 是否存在
       ↓ (不存在)
创建 ~/.claude/profiles/default/
       ↓
迁移现有 settings.json
       ↓
创建 profiles/work/ 并复制配置
       ↓
设置 process.env.CLAUDE_CONFIG_DIR
       ↓
输出切换结果和环境变量指令
       ↓
用户执行 export 命令（或自动执行）
       ↓
新启动的 Claude Code 读取新配置
```

### 9. 错误处理

1. **profiles 目录损坏**：检测到目录结构异常时，提供修复选项
2. **配置变体不存在**：提示用户先创建对应的 profile
3. **权限不足**：提示用户检查目录权限
4. **环境变量冲突**：检测到已存在的 CLAUDE_CONFIG_DIR，询问是否覆盖

### 10. 向后兼容性

1. **现有 settings.json.{variant} 文件**：继续支持，可以导入到 profiles 目录
2. **无环境变量时的行为**：回退到原有的 ~/.claude/settings.json
3. **旧的切换方式**：保持兼容，但推荐使用新的 profiles 方式

## 实现步骤

### 阶段 1：核心功能
1. 修改 ClaudeAdapter 添加 profiles 目录支持
2. 实现配置迁移逻辑
3. 修改 switch 命令支持 profiles 切换
4. 更新环境变量处理

### 阶段 2：增强功能
1. 添加 profiles 子命令
2. 实现 profile 创建/删除/列表功能
3. 添加自动持久化选项

### 阶段 3：完善
1. 添加 hooks 隔离支持
2. 改进错误处理和提示信息
3. 添加单元测试

## 风险与限制

1. **Windows 兼容性**：环境变量在 Windows 上工作方式相同，但路径格式需要处理
2. **现有 hook 配置**：如果用户使用了自定义 hooks，需要决定是否隔离
3. **配置同步**：profiles 之间的共享配置（如 api keys）需要特殊处理

## 验收标准

- [ ] 切换配置后，当前会话新启动的 Claude Code 使用新配置
- [ ] 其他已运行的 Claude Code 窗口不受影响
- [ ] 首次切换时自动迁移现有配置
- [ ] 支持创建、删除、切换 profiles
- [ ] 输出清晰的切换指导信息
- [ ] 向后兼容现有的 settings.json.{variant} 方式
