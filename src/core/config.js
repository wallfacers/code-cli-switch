import fs from 'node:fs';
import { getAdapter, listServices } from './registry.js';

/**
 * 扫描指定服务的所有配置变体
 * @param {string} service - 服务标识，默认为 claude
 * @returns {Array<{name: string, path: string, active: boolean}>}
 */
export function scanVariants(service = 'claude') {
  const adapter = getAdapter(service);
  if (!adapter) {
    return [];
  }

  return adapter.scanVariants();
}

/**
 * 扫描所有服务的所有配置变体
 * @returns {Map<string, Array<{name: string, path: string, active: boolean}>}
 */
export function scanAllVariants() {
  const result = new Map();
  const services = listServices();

  for (const { id } of services) {
    result.set(id, scanVariants(id));
  }

  return result;
}

/**
 * 读取指定服务的配置文件内容
 * @param {string} service - 服务标识
 * @param {string} variant - 配置变体名称，null 表示当前生效配置
 * @returns {object}
 */
export function readConfig(service, variant = null) {
  const adapter = getAdapter(service);
  if (!adapter) {
    return { success: false, error: `Unknown service: "${service}"` };
  }

  const filePath = variant ? adapter.getVariantPath(variant) : adapter.getTargetPath();

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }

  const validation = adapter.validate(filePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';

    return { success: false, error: errorMsg };
  }

  return { success: true, data: validation.data };
}

/**
 * 获取指定服务的配置文件信息
 * @param {string} service - 服务标识
 * @param {string} variant - 配置变体名称
 * @returns {object}
 */
export function getConfigInfo(service, variant) {
  const adapter = getAdapter(service);
  if (!adapter) {
    return { exists: false, error: `Unknown service: "${service}"` };
  }

  const filePath = adapter.getVariantPath(variant);

  if (!fs.existsSync(filePath)) {
    return { exists: false };
  }

  const stats = fs.statSync(filePath);

  return {
    exists: true,
    service,
    variant,
    path: filePath,
    size: stats.size,
    modified: stats.mtime
  };
}

/**
 * 获取指定服务的当前配置状态
 * @param {string} service - 服务标识
 * @returns {object}
 */
export function getCurrentStatus(service = 'claude') {
  const adapter = getAdapter(service);
  if (!adapter) {
    return { service: null, current: null, exists: false };
  }

  const state = adapter.readState();
  const targetPath = adapter.getTargetPath();

  return {
    service,
    current: state.current,
    hash: state.hash,
    lastModified: state.lastModified,
    exists: fs.existsSync(targetPath)
  };
}

/**
 * 获取所有服务的当前状态
 * @returns {Array<object>}
 */
export function getAllStatus() {
  const services = listServices();
  return services.map(({ id }) => getCurrentStatus(id));
}
