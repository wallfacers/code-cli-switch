import fs from 'node:fs';
import path from 'node:path';
import { ServiceAdapter, getUserProfile, getHomeDir } from './base.js';
import { validateJson } from '../validator.js';
import { fileHash } from '../../utils/hash.js';
import jsonDiff from 'json-diff';

/**
 * Claude 服务适配器
 * 处理 settings.json 格式的配置文件
 */
export class ClaudeAdapter extends ServiceAdapter {
  id = 'claude';
  name = 'Claude';
  extension = 'json';

  /**
   * 获取 Claude 配置目录路径
   * 优先级: CLAUDE_CONFIG_DIR > 默认路径
   * @returns {string}
   */
  getConfigDir() {
    const envPath = process.env.CLAUDE_CONFIG_DIR;
    if (envPath) {
      return envPath;
    }

    const platform = process.platform;
    if (platform === 'win32') {
      return path.join(getUserProfile(), '.claude');
    }
    return path.join(getHomeDir(), '.claude');
  }

  /**
   * 获取 settings.json 路径
   * @returns {string}
   */
  getTargetPath() {
    return path.join(this.getConfigDir(), 'settings.json');
  }

  /**
   * 获取候选配置文件路径
   * @param {string} variant - 配置变体名称
   * @returns {string}
   */
  getVariantPath(variant) {
    return path.join(this.getConfigDir(), `settings.json.${variant}`);
  }

  /**
   * 获取变体文件名模式
   * @returns {RegExp}
   */
  getVariantPattern() {
    return /^settings\.json\.(.+)$/;
  }

  /**
   * 从文件名提取变体名称
   * @param {string} filename
   * @returns {string|null}
   */
  extractVariantName(filename) {
    const match = filename.match(/^settings\.json\.(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * 验证 JSON 配置文件
   * @param {string} filePath
   * @returns {{valid: boolean, error?: string, data?: object}}
   */
  validate(filePath) {
    return validateJson(filePath);
  }

  /**
   * 格式化用于 diff 的内容
   * @param {string} content
   * @returns {string}
   */
  formatForDiff(content) {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  /**
   * 比较两个 JSON 配置文件的差异
   * @param {string} file1
   * @param {string} file2
   * @returns {{success: boolean, diff?: string, error?: string}}
   */
  diff(file1, file2) {
    try {
      const content1 = fs.readFileSync(file1, 'utf-8');
      const content2 = fs.readFileSync(file2, 'utf-8');

      const data1 = JSON.parse(content1);
      const data2 = JSON.parse(content2);

      const diff = jsonDiff.diffString(data1, data2);
      return { success: true, diff };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取配置文件基础名
   * @returns {string}
   */
  getBaseName() {
    return 'settings.json';
  }
}
