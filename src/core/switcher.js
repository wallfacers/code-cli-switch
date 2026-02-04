import fs from 'node:fs';
import { getSettingsPath, getVariantPath } from '../utils/path.js';
import { validateJson, fileExists } from './validator.js';
import { createBackup } from './backup.js';
import { updateCurrentState } from '../utils/state.js';
import { fileHash } from '../utils/hash.js';

/**
 * 切换到指定配置
 * @param {string} variant - 配置变体名称
 * @param {object} options - { dryRun: boolean, noBackup: boolean }
 * @returns {object}
 */
export function switchConfig(variant, options = {}) {
  const { dryRun = false, noBackup = false } = options;

  const sourcePath = getVariantPath(variant);
  const targetPath = getSettingsPath();

  // 1. 检查目标文件是否存在
  if (!fileExists(sourcePath)) {
    return {
      success: false,
      error: `Configuration variant "${variant}" not found`,
      suggestions: listAvailableVariants()
    };
  }

  // 2. JSON 语法校验
  const validation = validateJson(sourcePath);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid JSON in settings.json.${variant}: ${validation.error}`
    };
  }

  // Dry-run 模式只验证，不执行
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `Would switch to "${variant}"`,
      source: sourcePath,
      target: targetPath
    };
  }

  // 3. 备份当前配置
  let backupResult = null;
  if (fs.existsSync(targetPath) && !noBackup) {
    backupResult = createBackup();
    if (!backupResult.success) {
      return {
        success: false,
        error: `Failed to create backup: ${backupResult.error}`
      };
    }
  }

  try {
    // 4. 原子替换：使用临时文件确保原子性
    const tempPath = `${targetPath}.tmp`;
    fs.copyFileSync(sourcePath, tempPath);
    fs.copyFileSync(tempPath, targetPath);
    fs.unlinkSync(tempPath);

    // 5. 计算哈希并更新状态
    const hash = fileHash(targetPath);
    updateCurrentState(variant, hash);

    return {
      success: true,
      variant,
      backup: backupResult?.timestamp || null,
      message: `Switched to "${variant}"`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to switch: ${error.message}`
    };
  }
}

/**
 * 列出可用的配置变体
 * @returns {Array<string>}
 */
function listAvailableVariants() {
  const { scanVariants } = require('./config.js');
  return scanVariants().map(v => v.name);
}

/**
 * 预览切换差异
 * @param {string} variant
 * @returns {object}
 */
export function previewSwitch(variant) {
  return switchConfig(variant, { dryRun: true });
}
