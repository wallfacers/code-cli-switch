import path from 'node:path';
import { ServiceAdapter, getUserProfile, getHomeDir } from './base.js';
import { validateEnv, diffEnv } from '../formats/env.js';

/**
 * Gemini 服务适配器
 * 处理 .env 格式的配置文件
 */
export class GeminiAdapter extends ServiceAdapter {
  id = 'gemini';
  name = 'Gemini';
  extension = 'env';

  /**
   * 获取 Gemini 配置目录路径
   * @returns {string}
   */
  getConfigDir() {
    const envPath = process.env.GEMINI_CONFIG_DIR;
    if (envPath) {
      return envPath;
    }

    const platform = process.platform;
    if (platform === 'win32') {
      return path.join(getUserProfile(), '.gemini');
    }
    return path.join(getHomeDir(), '.gemini');
  }

  /**
   * 获取 .env 目标文件路径
   * @returns {string}
   */
  getTargetPath() {
    return path.join(this.getConfigDir(), '.env');
  }

  /**
   * 获取变体文件路径
   * @param {string} variant
   * @returns {string}
   */
  getVariantPath(variant) {
    return path.join(this.getConfigDir(), `.env.${variant}`);
  }

  /**
   * 获取变体文件名模式
   * @returns {RegExp}
   */
  getVariantPattern() {
    return /^\.env\.(.+)$/;
  }

  /**
   * 从文件名提取变体名称
   * @param {string} filename
   * @returns {string|null}
   */
  extractVariantName(filename) {
    const match = filename.match(/^\.env\.(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * 验证 .env 文件
   * @param {string} filePath
   * @returns {{valid: boolean, errors?: Array<string>, data?: object}}
   */
  validate(filePath) {
    return validateEnv(filePath);
  }

  /**
   * 比较两个 .env 文件的差异
   * @param {string} file1
   * @param {string} file2
   * @returns {{success: boolean, diff?: string, error?: string}}
   */
  diff(file1, file2) {
    return diffEnv(file1, file2);
  }

  /**
   * 获取配置文件基础名
   * @returns {string}
   */
  getBaseName() {
    return '.env';
  }
}
