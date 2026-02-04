import fs from 'node:fs';
import path from 'node:path';
import { ServiceAdapter, getUserProfile, getHomeDir } from './base.js';
import { validateToml, diffToml, parseEnvKey } from '../formats/toml.js';

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

  /**
   * 获取 auth.json 文件路径
   * @returns {string}
   */
  getAuthJsonPath() {
    return path.join(this.getConfigDir(), 'auth.json');
  }

  /**
   * 更新 auth.json 文件，从配置文件中提取 env_key
   * @param {string} configPath - 配置文件路径
   * @returns {{success: boolean, error?: string}}
   */
  updateAuthJson(configPath) {
    const result = parseEnvKey(configPath);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const authJsonPath = this.getAuthJsonPath();
    const envKeyValue = result.envKey;

    try {
      // 确保配置目录存在
      const configDir = this.getConfigDir();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 读取现有的 auth.json（如果存在）
      let authData = {};
      if (fs.existsSync(authJsonPath)) {
        try {
          const content = fs.readFileSync(authJsonPath, 'utf-8');
          authData = JSON.parse(content);
        } catch {
          // 如果解析失败，使用空对象
        }
      }

      // 更新 OPENAI_API_KEY
      authData.OPENAI_API_KEY = envKeyValue;

      // 写入 auth.json
      fs.writeFileSync(authJsonPath, JSON.stringify(authData, null, 2));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
