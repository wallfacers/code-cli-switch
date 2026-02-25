import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取 Claude 配置目录
 */
function getClaudeConfigDir() {
  return path.join(os.homedir(), '.claude');
}

/**
 * 获取 settings.json 路径
 */
function getSettingsPath() {
  return path.join(getClaudeConfigDir(), 'settings.json');
}

/**
 * 读取 settings.json
 */
function readSettings() {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`Warning: Failed to read settings.json: ${err.message}`);
    return {};
  }
}

/**
 * 写入 settings.json
 */
function writeSettings(settings) {
  const settingsPath = getSettingsPath();
  try {
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    return true;
  } catch (err) {
    throw new Error(`Failed to write settings.json: ${err.message}`);
  }
}

/**
 * 检查 hook 是否已在 settings.json 中配置（支持 PreToolUse 或 ConfigChange）
 */
function isHookConfigured() {
  const settings = readSettings();
  const hooks = settings.hooks;
  if (!hooks) {
    return false;
  }

  // 检查 PreToolUse（兼容旧配置）
  if (hooks.PreToolUse) {
    const hasPreToolUse = hooks.PreToolUse.some(block =>
      block.hooks &&
      block.hooks.some(h => h.command && h.command.includes('block-user-settings-change'))
    );
    if (hasPreToolUse) {
      return true;
    }
  }

  // 检查 ConfigChange
  if (hooks.ConfigChange) {
    return hooks.ConfigChange.some(block =>
      block.hooks &&
      block.hooks.some(h => h.command && h.command.includes('block-user-settings-change'))
    );
  }

  return false;
}

/**
 * 获取项目内 hook 源文件路径
 */
export function getHookSourcePath() {
  const projectRoot = path.resolve(__dirname, '../../');
  return path.join(projectRoot, 'hooks', 'block-user-settings-change.js');
}

/**
 * 获取目标安装路径
 * ~/.claude/hooks/block-user-settings-change.js
 */
export function getHookTargetPath() {
  const configDir = path.join(os.homedir(), '.claude');
  return path.join(configDir, 'hooks', 'block-user-settings-change.js');
}

/**
 * 获取跨平台的 hook 命令
 * Windows: node "%USERPROFILE%\.claude\hooks\block-user-settings-change.js"
 * Unix: node "~/.claude/hooks/block-user-settings-change.js"
 */
export function getHookCommand() {
  const targetPath = getHookTargetPath();
  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    // Windows: 使用 %USERPROFILE% 环境变量
    // 转换路径分隔符，并构建相对于用户目录的路径
    const homeDir = os.homedir();
    const relativePath = targetPath.replace(homeDir, '').replace(/^\//, '').replace(/\//g, '\\');
    return `node "%USERPROFILE%\\${relativePath}"`;
  } else {
    // Unix: 使用 ~
    const homeDir = os.homedir();
    const relativePath = targetPath.replace(homeDir, '~');
    return `node "${relativePath}"`;
  }
}

/**
 * 读取 hook 源文件内容
 */
export function getHookContent() {
  const sourcePath = getHookSourcePath();
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Hook source file not found: ${sourcePath}`);
  }
  try {
    return fs.readFileSync(sourcePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read hook source file ${sourcePath}: ${err.message}`);
  }
}

/**
 * 安装 hook（直接覆盖）
 */
export async function installHook() {
  const targetPath = getHookTargetPath();
  const content = getHookContent();

  // 确保目标目录存在
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      throw new Error(`Failed to create directory ${targetDir}: ${err.message}`);
    }
  }

  // 复制 hook 文件
  try {
    fs.writeFileSync(targetPath, content, 'utf8');
  } catch (err) {
    throw new Error(`Failed to write file ${targetPath}: ${err.message}`);
  }

  // 配置 settings.json
  configureSettings();

  return {
    success: true,
    path: targetPath
  };
}

/**
 * 配置 settings.json 中的 hook
 * 使用 ConfigChange 事件来监听配置文件变更
 */
function configureSettings() {
  // 如果已经配置，跳过
  if (isHookConfigured()) {
    return;
  }

  const settings = readSettings();
  const hookCommand = getHookCommand();

  // 初始化 hooks 结构
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // 使用 ConfigChange 监听 user_settings 变更
  if (!settings.hooks.ConfigChange) {
    settings.hooks.ConfigChange = [];
  }

  // 查找是否已有 ConfigChange 的 user_settings matcher
  const existingUserSettingsBlock = settings.hooks.ConfigChange.find(
    block => block.matcher === 'user_settings'
  );

  // 检查 hook 命令是否已存在（避免重复添加）
  const hookExists = (block) =>
    block.hooks &&
    block.hooks.some(h => h.command && h.command.includes('block-user-settings-change'));

  if (existingUserSettingsBlock && hookExists(existingUserSettingsBlock)) {
    // 已存在且包含该 hook，跳过
    return;
  }

  if (existingUserSettingsBlock) {
    // 存在 user_settings block，追加 hook
    if (!existingUserSettingsBlock.hooks) {
      existingUserSettingsBlock.hooks = [];
    }
    existingUserSettingsBlock.hooks.push({
      type: 'command',
      command: hookCommand
    });
  } else {
    // 不存在，创建新的 ConfigChange 配置
    settings.hooks.ConfigChange.push({
      matcher: 'user_settings',
      hooks: [
        {
          type: 'command',
          command: hookCommand
        }
      ]
    });
  }

  writeSettings(settings);
}

/**
 * 检查并安装 hook
 */
export async function checkAndInstall() {
  const targetPath = getHookTargetPath();

  // 如果目标文件不存在，直接安装
  if (!fs.existsSync(targetPath)) {
    return installHook();
  }

  // 目标文件存在，对比内容后覆盖
  const sourceContent = getHookContent();
  let targetContent;
  try {
    targetContent = fs.readFileSync(targetPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read target file ${targetPath}: ${err.message}`);
  }

  // 如果文件内容不同，更新文件
  if (sourceContent !== targetContent) {
    return installHook();
  }

  // 文件内容相同，但可能未配置到 settings.json
  if (!isHookConfigured()) {
    configureSettings();
    return {
      success: true,
      path: targetPath,
      updated: true,
      reason: 'configured in settings.json'
    };
  }

  return {
    success: true,
    path: targetPath,
    updated: false,
    reason: 'content unchanged'
  };
}
