import fs from 'node:fs';
import { getAdapter } from './registry.js';
import { fileHash } from '../utils/hash.js';
import { createBackup as createBackupForService } from './backup.js';

/**
 * 切换到指定配置
 * @param {string} service - 服务标识 (claude/gemini/codex)，默认为 claude
 * @param {string} variant - 配置变体名称
 * @param {object} options - { dryRun: boolean, noBackup: boolean }
 * @returns {object}
 */
export function switchConfig(service, variant, options = {}) {
  // 兼容旧接口：如果第二个参数是对象，说明 service 未传递
  if (typeof variant === 'object') {
    options = variant;
    variant = service;
    service = 'claude';
  }

  const { dryRun = false, noBackup = false } = options;

  const adapter = getAdapter(service);
  if (!adapter) {
    return {
      success: false,
      error: `Unknown coding tool: "${service}"`,
      suggestions: listAvailableServices()
    };
  }

  const sourcePath = adapter.getVariantPath(variant);
  const targetPath = adapter.getTargetPath();

  // 1. 检查目标文件是否存在
  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      error: `Configuration variant "${variant}" not found`,
      suggestions: listAvailableVariants(adapter)
    };
  }

  // 2. 格式校验
  const validation = adapter.validate(sourcePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';

    return {
      success: false,
      error: `Invalid format in ${adapter.getBaseName()}.${variant}: ${errorMsg}`
    };
  }

  // Dry-run 模式只验证，不执行
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      service,
      message: `Would switch ${service} to "${variant}"`,
      source: sourcePath,
      target: targetPath
    };
  }

  // 3. 备份当前配置
  let backupResult = null;
  if (fs.existsSync(targetPath) && !noBackup) {
    backupResult = createBackupForService(service);
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
    adapter.writeState(variant, hash);

    // 6. Codex 特殊处理：更新 auth.json
    if (service === 'codex' && typeof adapter.updateAuthJson === 'function') {
      const authResult = adapter.updateAuthJson(targetPath);
      if (!authResult.success) {
        // auth.json 更新失败不影响主流程，但记录警告
        console.warn(`Warning: Failed to update auth.json: ${authResult.error}`);
      }
    }

    return {
      success: true,
      service,
      variant,
      backup: backupResult?.timestamp || null,
      message: `Switched ${service} to "${variant}"`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to switch: ${error.message}`
    };
  }
}

/**
 * 预览切换差异
 * @param {string} service - 服务标识
 * @param {string} variant
 * @returns {object}
 */
export function previewSwitch(service, variant) {
  return switchConfig(service, variant, { dryRun: true });
}

/**
 * 列出可用的服务
 * @returns {Array<string>}
 */
function listAvailableServices() {
  const { listServices } = require('./registry.js');
  return listServices().map(s => s.id);
}

/**
 * 列出指定服务的可用配置变体
 * @param {ServiceAdapter} adapter
 * @returns {Array<string>}
 */
function listAvailableVariants(adapter) {
  return adapter.scanVariants().map(v => v.name);
}
