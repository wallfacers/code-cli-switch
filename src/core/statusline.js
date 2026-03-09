import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { spawnSync } from 'node:child_process';

// 获取当前模块所在的项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * 厂商颜色映射表 (ANSI 256色)
 */
export const VENDOR_COLORS = {
  // 国内大模型
  'glm': '\x1b[38;5;46m',      // 亮绿色 - 智谱 GLM
  'kimi': '\x1b[38;5;51m',     // 青色 - 月之暗面
  'minimax': '\x1b[38;5;220m', // 金色 - MiniMax
  'deepseek': '\x1b[38;5;33m', // 蓝色 - DeepSeek
  'qwen': '\x1b[38;5;209m',    // 橙色 - 通义千问
  'duckcoding': '\x1b[38;5;105m', // 紫色 - DuckCoding

  // 国际大模型
  'claude': '\x1b[38;5;175m',  // 粉紫色 - Anthropic
  'openai': '\x1b[38;5;76m',   // 绿色 - OpenAI
  'gemini': '\x1b[38;5;81m',   // 天蓝色 - Google

  // 自定义厂商
  'cc': '\x1b[38;5;201m',      // 洋红色 - CC

  // 其他
  'default': '\x1b[38;5;246m'  // 灰色 - 未知厂商
};

/**
 * ANSI 重置码
 */
export const RESET = '\x1b[0m';

/**
 * 新增 ANSI 样式常量
 */
export const DIM = '\x1b[2m';
export const CYAN = '\x1b[36m';
export const GREEN_BRIGHT = '\x1b[32m';

/**
 * 进度条渐变颜色
 */
export const PROGRESS_COLORS = {
  safe: '\x1b[32m',    // 绿色 <50%
  warning: '\x1b[33m', // 黄色 50-79%
  danger: '\x1b[31m'   // 红色 >=80%
};

/**
 * 根据百分比获取进度条颜色
 * @param {number} percent - 使用百分比 (0-100)
 * @returns {string} ANSI 颜色码
 */
export function getProgressColor(percent) {
  if (percent >= 80) return PROGRESS_COLORS.danger;
  if (percent >= 50) return PROGRESS_COLORS.warning;
  return PROGRESS_COLORS.safe;
}

/**
 * 渲染进度条
 * @param {number} percent - 使用百分比 (0-100)
 * @param {number} width - 进度条宽度 (默认 10)
 * @returns {string} 带颜色的进度条字符串
 */
export function renderProgressBar(percent, width = 10) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const color = getProgressColor(percent);
  return `${color}${'▓'.repeat(filled)}${'░'.repeat(empty)}${RESET}`;
}

/**
 * 计算上下文窗口使用百分比
 * @param {object|null} contextData - context_window 数据
 * @returns {number} 使用百分比 (0-100)
 */
export function calculateContextPercent(contextData) {
  if (!contextData || !contextData.current_usage) {
    return 0;
  }

  const usage = contextData.current_usage;
  const totalTokens =
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);

  const windowSize = contextData.context_window_size || 200000;

  return Math.round((totalTokens / windowSize) * 100);
}

/**
 * 从路径中提取目录名称
 * @param {string|null} cwd - 完整路径
 * @returns {string} 目录名称
 */
export function getDirName(cwd) {
  if (!cwd) return '';
  return basename(cwd);
}

/**
 * 获取当前 git 分支名称
 * @param {string|null} cwd - 工作目录路径
 * @returns {string|null} 分支名称，如果不是 git 仓库则返回 null
 */
export function getGitBranch(cwd) {
  if (!cwd) return null;

  try {
    const result = spawnSync('git', ['branch', '--show-current'], {
      cwd: cwd,
      encoding: 'utf-8',
      timeout: 500,
      windowsHide: true
    });

    if (result.status === 0 && result.stdout) {
      const branch = result.stdout.trim();
      return branch || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 渲染完整状态栏
 * @param {string} vendor - 厂商名称
 * @param {object|null} contextData - context_window 数据
 * @param {string|null} cwd - 当前工作目录
 * @returns {string} 格式化的状态栏字符串
 */
export function renderStatusBar(vendor, contextData, cwd = null) {
  const vendorColor = getVendorColor(vendor);
  const vendorName = formatVendor(vendor);
  const vendorPart = `${vendorColor}厂商:${vendorName}${RESET}`;

  const percent = calculateContextPercent(contextData);
  const bar = renderProgressBar(percent);

  const dirName = getDirName(cwd);
  const dirPart = dirName ? ` | 📁${dirName}` : '';

  const gitBranch = getGitBranch(cwd);
  const gitPart = gitBranch ? ` | 🌿${gitBranch}` : '';

  return `${vendorPart} | 上下文:${percent}% ${bar}${dirPart}${gitPart}`;
}

/**
 * 获取厂商对应的颜色码
 * @param {string} vendor - 厂商名称
 * @returns {string} ANSI 颜色码
 */
export function getVendorColor(vendor) {
  if (!vendor) return VENDOR_COLORS.default;
  const key = vendor.toLowerCase();
  return VENDOR_COLORS[key] || VENDOR_COLORS.default;
}

/**
 * 格式化厂商名称（大写）
 * @param {string} vendor - 厂商名称
 * @returns {string} 格式化后的名称
 */
export function formatVendor(vendor) {
  if (!vendor) return 'UNKNOWN';
  return String(vendor).toUpperCase();
}

/**
 * 生成带颜色的厂商显示文本
 * @param {string} vendor - 厂商名称
 * @returns {string} 带颜色的文本
 */
export function renderVendor(vendor) {
  const color = getVendorColor(vendor);
  const name = formatVendor(vendor);
  return `${color}${name}${RESET}`;
}

/**
 * 获取 statusline 脚本的绝对路径
 * @returns {string} 脚本路径
 */
export function getStatuslineScriptPath() {
  return path.join(PROJECT_ROOT, 'bin', 'statusline.js');
}

/**
 * 将原始模型 ID 解析为简短显示名
 * @param {string|null} modelStr - 原始模型 ID（如 "claude-opus-4-6"）
 * @returns {string} 简短显示名（如 "Opus 4.6"）
 */
export function parseModelName(modelStr) {
  if (!modelStr) return '';
  const s = String(modelStr).toLowerCase();

  if (s.startsWith('claude-')) {
    const rest = s.slice(7);
    const parts = rest.split('-');
    const family = parts[0];
    const versionParts = [];
    for (let i = 1; i < parts.length; i++) {
      if (/^\d/.test(parts[i]) && parts[i].length <= 4) {
        versionParts.push(parts[i]);
      } else {
        break;
      }
    }
    const familyDisplay = family.charAt(0).toUpperCase() + family.slice(1);
    return versionParts.length > 0
      ? `${familyDisplay} ${versionParts.join('.')}`
      : familyDisplay;
  }

  if (s.startsWith('gpt-')) {
    return 'GPT-' + modelStr.slice(4);
  }

  if (s.startsWith('gemini-')) {
    return 'Gemini ' + modelStr.slice(7);
  }

  return modelStr;
}

/**
 * 将状态字符串渲染为带圆点的 dim 文本
 * @param {string|null} status - 状态字符串（如 "thinking"、"idle"）
 * @returns {string} 带颜色的状态文本
 */
export function renderStatus(status) {
  const text = status ? `● ${status}` : '● active';
  return `${DIM}${text}${RESET}`;
}

/**
 * 生成 statusLine 配置
 * @param {string} vendor - 厂商名称
 * @returns {object} statusLine 配置对象
 */
export function generateStatusLineConfig(vendor) {
  const scriptPath = getStatuslineScriptPath();
  // 使用正斜杠确保跨平台兼容性
  const normalizedPath = scriptPath.replace(/\\/g, '/');

  return {
    type: 'command',
    command: `node "${normalizedPath}" ${vendor}`,
    padding: 1
  };
}

/**
 * 向 settings.json 注入 statusLine 配置
 * @param {string} filePath - settings.json 文件路径
 * @param {string} vendor - 厂商名称
 * @returns {{success: boolean, error?: string}}
 */
export function injectStatusLine(filePath, vendor) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);

    // 注入 statusLine 配置
    config.statusLine = generateStatusLineConfig(vendor);

    // 写回文件
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
