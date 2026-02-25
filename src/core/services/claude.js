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
    // Check if profile exists first
    const profilePath = this.getProfilePath(variant);
    if (fs.existsSync(profilePath)) {
      return profilePath;
    }
    // Fallback to legacy path
    return path.join(this.getConfigDir(), `settings.json.${variant}`);
  }

  /**
   * 获取 profiles 目录路径
   * @returns {string}
   */
  getProfilesDir() {
    return path.join(this.getConfigDir(), 'profiles');
  }

  /**
   * 获取指定 profile 的配置目录
   * @param {string} variant - 配置变体名称
   * @returns {string}
   */
  getProfileDir(variant) {
    return path.join(this.getProfilesDir(), variant);
  }

  /**
   * 获取指定 profile 的 settings.json 路径
   * @param {string} variant - 配置变体名称
   * @returns {string}
   */
  getProfilePath(variant) {
    return path.join(this.getProfileDir(variant), 'settings.json');
  }

  /**
   * 检查 profiles 目录是否已初始化
   * @returns {boolean}
   */
  profilesInitialized() {
    try {
      const profilesDir = this.getProfilesDir();
      return fs.existsSync(profilesDir) && fs.statSync(profilesDir).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 迁移 legacy 变体到 profiles 目录
   * @param {string} variant - 配置变体名称
   * @returns {{success: boolean, migrated?: boolean, error?: string}}
   */
  migrateVariantToProfile(variant) {
    try {
      const legacyPath = path.join(this.getConfigDir(), `settings.json.${variant}`);
      const profilePath = this.getProfilePath(variant);

      if (fs.existsSync(profilePath)) {
        return { success: true, migrated: false };
      }

      if (!fs.existsSync(legacyPath)) {
        return { success: false, error: `Legacy variant "${variant}" not found` };
      }

      fs.mkdirSync(this.getProfileDir(variant), { recursive: true });
      fs.copyFileSync(legacyPath, profilePath);

      return { success: true, migrated: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 扫描所有配置变体 (包括 profiles 目录和 legacy 文件)
   * @returns {Array<{name: string, path: string, active: boolean, current: boolean}>}
   */
  scanVariants() {
    const configDir = this.getConfigDir();
    const targetPath = this.getTargetPath();
    const variants = [];
    const variantNames = new Set();
    const state = this.readState();

    // Get current hash for active detection
    const currentHash = fs.existsSync(targetPath) ? fileHash(targetPath) : null;

    // Helper to add variant
    const addVariant = (name, filePath) => {
      if (variantNames.has(name)) return;

      let active = false;
      if (currentHash && fs.existsSync(filePath)) {
        const variantHash = fileHash(filePath);
        active = variantHash === currentHash;
      }

      variants.push({
        name,
        path: filePath,
        active,
        current: state.current === name
      });
      variantNames.add(name);
    };

    // Scan profiles directory
    const profilesDir = this.getProfilesDir();
    if (fs.existsSync(profilesDir)) {
      const profileDirs = fs.readdirSync(profilesDir, { withFileTypes: true });
      for (const dir of profileDirs) {
        if (dir.isDirectory()) {
          const profilePath = this.getProfilePath(dir.name);
          if (fs.existsSync(profilePath)) {
            addVariant(dir.name, profilePath);
          }
        }
      }
    }

    // Scan legacy files in config directory
    if (fs.existsSync(configDir)) {
      const files = fs.readdirSync(configDir);
      for (const file of files) {
        const variant = this.extractVariantName(file);
        if (variant) {
          const filePath = path.join(configDir, file);
          addVariant(variant, filePath);
        }
      }
    }

    // Check if state file's variant still exists
    if (state.current && !variantNames.has(state.current)) {
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
