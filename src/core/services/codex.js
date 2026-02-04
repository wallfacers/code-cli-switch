import path from 'node:path';
import { ServiceAdapter, getUserProfile, getHomeDir } from './base.js';
import { validateToml, diffToml } from '../formats/toml.js';

/**
 * Codex 服务适配器
 * 处理 config.toml 格式的配置文件
 */
export class CodexAdapter extends ServiceAdapter {
  id = 'codex';
  name = 'Codex';
  extension = 'toml';

  /**
   * 获取 Codex 配置目录路径
   * @returns {string}
   */
  getConfigDir() {
    const envPath = process.env.CODEX_CONFIG_DIR;
    if (envPath) {
      return envPath;
    }

    const platform = process.platform;
    if (platform === 'win32') {
      return path.join(getUserProfile(), '.codex');
    }
    return path.join(getHomeDir(), '.codex');
  }

  /**
   * 获取 config.toml 目标文件路径
   * @returns {string}
   */
  getTargetPath() {
    return path.join(this.getConfigDir(), 'config.toml');
  }

  /**
   * 获取变体文件路径
   * @param {string} variant
   * @returns {string}
   */
  getVariantPath(variant) {
    return path.join(this.getConfigDir(), `config.toml.${variant}`);
  }

  /**
   * 获取变体文件名模式
   * @returns {RegExp}
   */
  getVariantPattern() {
    return /^config\.toml\.(.+)$/;
  }

  /**
   * 从文件名提取变体名称
   * @param {string} filename
   * @returns {string|null}
   */
  extractVariantName(filename) {
    const match = filename.match(/^config\.toml\.(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * 验证 TOML 文件
   * @param {string} filePath
   * @returns {{valid: boolean, errors?: Array<string>, raw?: string}}
   */
  validate(filePath) {
    return validateToml(filePath);
  }

  /**
   * 比较两个 TOML 文件的差异
   * @param {string} file1
   * @param {string} file2
   * @returns {{success: boolean, diff?: string, error?: string}}
   */
  diff(file1, file2) {
    return diffToml(file1, file2);
  }

  /**
   * 获取配置文件基础名
   * @returns {string}
   */
  getBaseName() {
    return 'config.toml';
  }
}
