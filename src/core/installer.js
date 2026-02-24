import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, 'hooks', 'block-user-settings-change.js');
}

/**
 * 读取 hook 源文件内容
 */
export function getHookContent() {
  const sourcePath = getHookSourcePath();
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Hook source file not found: ${sourcePath}`);
  }
  return fs.readFileSync(sourcePath, 'utf8');
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
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 直接写入（覆盖）
  fs.writeFileSync(targetPath, content, 'utf8');

  return {
    success: true,
    path: targetPath
  };
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
  const targetContent = fs.readFileSync(targetPath, 'utf8');

  if (sourceContent !== targetContent) {
    return installHook();
  }

  return {
    success: true,
    path: targetPath,
    updated: false,
    reason: 'content unchanged'
  };
}
