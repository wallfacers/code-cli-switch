import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'locales');

// 默认语言
const DEFAULT_LANG = 'zh';

// 当前语言
let currentLang = DEFAULT_LANG;

// 缓存翻译
const translations = {};

/**
 * 加载语言文件
 * @param {string} lang 语言代码
 * @returns {object} 翻译对象
 */
function loadTranslations(lang) {
  if (translations[lang]) {
    return translations[lang];
  }

  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    try {
      translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return translations[lang];
    } catch {
      console.warn(`Failed to load locale file: ${filePath}`);
    }
  }

  // 如果加载失败，返回空对象
  return {};
}

/**
 * 获取翻译文本
 * @param {string} key 翻译键，支持点号分隔的嵌套路径
 * @param {object} params 参数对象
 * @returns {string} 翻译后的文本
 * @example
 * t('app.title') // 配置切换器
 * t('message.switched', { name: 'prod' }) // 已切换到 prod
 */
export function t(key, params = {}) {
  const messages = loadTranslations(currentLang);

  // 支持嵌套路径，如 'app.title'
  const value = key.split('.').reduce((obj, k) => obj?.[k], messages);

  if (value === undefined) {
    // 如果当前语言没有找到，尝试使用默认语言
    if (currentLang !== DEFAULT_LANG) {
      const defaultMessages = loadTranslations(DEFAULT_LANG);
      const defaultValue = key.split('.').reduce((obj, k) => obj?.[k], defaultMessages);
      if (defaultValue !== undefined) {
        return interpolate(defaultValue, params);
      }
    }
    // 都没有找到，返回 key 本身
    return key;
  }

  return interpolate(value, params);
}

/**
 * 参数插值
 * @param {string} template 模板字符串，支持 {{name}} 语法
 * @param {object} params 参数对象
 * @returns {string} 插值后的字符串
 */
function interpolate(template, params) {
  if (typeof template !== 'string') {
    return String(template);
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

/**
 * 设置当前语言
 * @param {string} lang 语言代码
 */
export function setLanguage(lang) {
  currentLang = lang;
}

/**
 * 获取当前语言
 * @returns {string} 当前语言代码
 */
export function getLanguage() {
  return currentLang;
}

/**
 * 初始化 i18n，从环境变量或配置读取语言设置
 * @param {object} config 配置对象
 */
export function initI18n(config = {}) {
  // 优先级：配置 > 环境变量 > 默认值
  const envLang = process.env.CS_CLI_LANG || process.env.LANG?.split('.')[0]?.replace('_', '-');
  currentLang = config.lang || envLang || DEFAULT_LANG;

  // 简化语言代码（如 zh-CN -> zh）
  if (currentLang.includes('-')) {
    currentLang = currentLang.split('-')[0];
  }

  // 只支持中文和英文
  if (!['zh', 'en'].includes(currentLang)) {
    currentLang = DEFAULT_LANG;
  }

  // 预加载翻译
  loadTranslations(currentLang);
}

export default { t, setLanguage, getLanguage, initI18n };
