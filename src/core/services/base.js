import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileHash } from '../../utils/hash.js';
import { formatDate } from '../../utils/date.js';

/**
 * 服务适配器基类
 * 所有服务适配器必须实现此接口
 */
export class ServiceAdapter {
  /**
   * 服务标识（必须由子类实现）
   * @type {string}
   */
  id = null;

  /**
   * 人类可读的服务名称（必须由子类实现）
   * @type {string}
   */
  name = null;

  /**
   * 配置文件扩展名（必须由子类实现）
   * @type {string}
   */
  extension = null;

  /**
   * 获取配置目录路径
   * @returns {string}
   */
  getConfigDir() {
    throw new Error('getConfigDir must be implemented by subclass');
  }

  /**
   * 获取目标配置文件路径
   * @returns {string}
   */
  getTargetPath() {
    throw new Error('getTargetPath must be implemented by subclass');
  }

  /**
   * 获取变体配置文件路径
   * @param {string} _variant - 配置变体名称
   * @returns {string}
   */
  getVariantPath(_variant) {
    throw new Error('getVariantPath must be implemented by subclass');
  }

  /**
   * 获取变体文件名模式（用于扫描）
   * @returns {string} 正则表达式或文件名模式
   */
  getVariantPattern() {
    throw new Error('getVariantPattern must be implemented by subclass');
  }

  /**
   * 从文件名提取变体名称
   * @param {string} _filename - 文件名
   * @returns {string|null} 变体名称或 null
   */
  extractVariantName(_filename) {
    throw new Error('extractVariantName must be implemented by subclass');
  }

  /**
   * 扫描所有配置变体
   * @returns {Array<{name: string, path: string, active: boolean}>}
   */
  scanVariants() {
    const configDir = this.getConfigDir();
    const targetPath = this.getTargetPath();

    if (!fs.existsSync(configDir)) {
      return [];
    }

    const files = fs.readdirSync(configDir);
    const variants = [];
    const state = this.readState();

    // 获取当前生效配置的哈希
    const currentHash = fs.existsSync(targetPath) ? fileHash(targetPath) : null;

    for (const file of files) {
      const variant = this.extractVariantName(file);
      if (!variant) continue;

      const filePath = this.getVariantPath(variant);

      // 检查是否是当前生效的配置
      let active = false;
      if (currentHash && fs.existsSync(filePath)) {
        const variantHash = fileHash(filePath);
        active = variantHash === currentHash;
      }

      variants.push({
        name: variant,
        path: filePath,
        active,
        current: state.current === variant
      });
    }

    // 检查状态文件记录的变体是否还存在
    if (state.current && !variants.some(v => v.name === state.current)) {
      // 状态文件记录的变体不存在了，清除状态
      this.clearState();
    }

    return variants.sort((a, b) => {
      if (a.active) return -1;
      if (a.current) return -1;
      if (b.active) return 1;
      if (b.current) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 验证配置文件
   * @param {string} _filePath - 文件路径
   * @returns {{valid: boolean, error?: string, data?: any, errors?: Array<string>}}
   */
  validate(_filePath) {
    throw new Error('validate must be implemented by subclass');
  }

  /**
   * 格式化用于 diff 的内容
   * @param {string} content - 原始内容
   * @returns {string} 格式化后的内容
   */
  formatForDiff(content) {
    return content;
  }

  /**
   * 比较两个配置文件的差异
   * @param {string} _file1 - 第一个文件路径
   * @param {string} _file2 - 第二个文件路径
   * @returns {{success: boolean, diff?: string, error?: string}}
   */
  diff(_file1, _file2) {
    throw new Error('diff must be implemented by subclass');
  }

  /**
   * 获取状态文件路径
   * @returns {string}
   */
  getStatePath() {
    return path.join(this.getConfigDir(), '.cs-state.json');
  }

  /**
   * 读取状态
   * @returns {{current: string|null, hash: string|null, lastModified: string|null}}
   */
  readState() {
    const statePath = this.getStatePath();
    if (!fs.existsSync(statePath)) {
      return { current: null, hash: null, lastModified: null };
    }

    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { current: null, hash: null, lastModified: null };
    }
  }

  /**
   * 写入状态
   * @param {string} variant - 变体名称
   * @param {string} hash - 文件哈希
   */
  writeState(variant, hash) {
    const statePath = this.getStatePath();
    const state = {
      current: variant,
      hash: hash,
      lastModified: formatDate()
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * 清除状态文件
   */
  clearState() {
    const statePath = this.getStatePath();
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  }

  /**
   * 获取备份目录路径
   * @returns {string}
   */
  getBackupDir() {
    return path.join(this.getConfigDir(), 'backups');
  }

  /**
   * 获取备份文件路径
   * @param {string} timestamp - 时间戳
   * @returns {string}
   */
  getBackupPath(timestamp) {
    const ext = this.extension || 'bak';
    return path.join(this.getBackupDir(), `${this.getBaseName()}.${timestamp}.${ext}`);
  }

  /**
   * 获取配置文件基础名（不含扩展名和路径）
   * @returns {string}
   */
  getBaseName() {
    throw new Error('getBaseName must be implemented by subclass');
  }

  /**
   * 确保备份目录存在
   */
  ensureBackupDir() {
    const dir = this.getBackupDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}

/**
 * 获取用户主目录
 * @returns {string}
 */
export function getHomeDir() {
  return os.homedir();
}

/**
 * 获取 Windows 用户目录
 * @returns {string}
 */
export function getUserProfile() {
  return process.env.USERPROFILE || getHomeDir();
}
