import fs from 'node:fs';
import { getConfigDir, getSettingsPath, getVariantPath } from '../utils/path.js';
import { validateJson } from './validator.js';

/**
 * 扫描所有配置变体
 * @returns {Array<{name: string, path: string, active: boolean}>}
 */
export function scanVariants() {
  const configDir = getConfigDir();
  const settingsPath = getSettingsPath();

  if (!fs.existsSync(configDir)) {
    return [];
  }

  const files = fs.readdirSync(configDir);
  const variants = [];

  // 获取当前生效配置的哈希（用于匹配来源）
  let currentHash = null;
  if (fs.existsSync(settingsPath)) {
    try {
      const currentContent = fs.readFileSync(settingsPath, 'utf-8');
      currentHash = Buffer.from(currentContent).toString('base64').slice(0, 32);
    } catch {
      // 忽略
    }
  }

  for (const file of files) {
    const match = file.match(/^settings\.json\.(.+)$/);
    if (!match) continue;

    const variant = match[1];
    const filePath = getVariantPath(variant);

    // 检查是否是当前生效的配置
    let active = false;
    if (currentHash && fs.existsSync(filePath)) {
      try {
        const variantContent = fs.readFileSync(filePath, 'utf-8');
        const variantHash = Buffer.from(variantContent).toString('base64').slice(0, 32);
        active = variantHash === currentHash;
      } catch {
        // 忽略
      }
    }

    variants.push({
      name: variant,
      path: filePath,
      active
    });
  }

  return variants.sort((a, b) => {
    if (a.active) return -1;
    if (b.active) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 读取配置文件内容
 * @param {string} variant - 配置变体名称，null 表示当前生效配置
 * @returns {object}
 */
export function readConfig(variant = null) {
  const filePath = variant ? getVariantPath(variant) : getSettingsPath();

  const validation = validateJson(filePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return { success: true, data: validation.data };
}

/**
 * 获取配置文件信息
 * @param {string} variant
 * @returns {object}
 */
export function getConfigInfo(variant) {
  const filePath = getVariantPath(variant);

  if (!fs.existsSync(filePath)) {
    return { exists: false };
  }

  const stats = fs.statSync(filePath);

  return {
    exists: true,
    path: filePath,
    size: stats.size,
    modified: stats.mtime
  };
}
