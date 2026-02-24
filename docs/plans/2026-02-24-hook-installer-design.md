# Hook 安装功能设计文档

**日期**: 2026-02-24
**版本**: 1.0.0

## 1. 概述

在 cs-cli 项目中提供跨平台的 ConfigChange hook 脚本，并在 npm install、npm install -g 和 cs-cli 切换时自动安装/更新 hook。

## 2. 目录结构

```
cs-cli/
├── hooks/
│   └── block-user-settings-change.js   # hook 脚本（跨平台）
├── src/
│   ├── core/
│   │   └── installer.js                # hook 安装逻辑
│   └── ...
└── package.json
```

## 3. Hook 脚本

### 功能
- 读取 stdin 的 JSON 输入（Claude Code ConfigChange hook 传入）
- 提取 file_path 字段
- 写入日志到 `~/.claude/logs/blocked-changes.log`
- 返回 block 决策阻止配置变更应用到当前会话

### 跨平台特性
- 不依赖 bash，使用 Node.js 原生 API
- 使用 `os.homedir()` 和 `path.join()` 处理路径
- 自动创建日志目录

## 4. 安装器逻辑

### API 设计

```js
// src/core/installer.js

/**
 * 获取项目内 hook 源文件路径
 */
function getHookSourcePath(): string

/**
 * 获取目标安装路径
 * ~/.claude/hooks/block-user-settings-change.js
 * 优先使用环境变量 CLAUDE_CONFIG_DIR
 */
function getHookTargetPath(): string

/**
 * 读取 hook 源文件内容
 */
function getHookContent(): string

/**
 * 安装 hook（直接覆盖）
 * 确保目录存在，写入文件
 */
function installHook(): Promise<void>

/**
 * 检查并安装 hook
 * cs-cli 切换时调用
 */
async function checkAndInstall(): Promise<boolean>
```

### 路径解析顺序
1. 环境变量 `CLAUDE_CONFIG_DIR`
2. Windows: `%USERPROFILE%\.claude`
3. macOS/Linux: `~/.claude`

## 5. 安装触发点

| 触发时机 | 实现方式 |
|---------|---------|
| `npm install` | package.json 的 postinstall 脚本 |
| `npm install -g .` | 同上 |
| `cs-cli switch` | 在切换逻辑执行前调用 `installer.checkAndInstall()` |

## 6. 错误处理

| 场景 | 处理 |
|-----|------|
| 目标目录创建失败 | 打印警告，继续执行 |
| 文件写入失败 | 打印错误信息 |
| 读取源文件失败 | 中止安装，抛出错误 |
