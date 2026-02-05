import fs from 'node:fs';
import { parse } from 'smol-toml';

/**
 * 从 TOML 文件中解析 env_key 的值
 * @param {string} filePath - TOML 文件路径
 * @returns {{success: boolean, envKey?: string, error?: string}}
 */
export function parseEnvKey(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = parse(content);

    // 1. 首先尝试从 model_providers.{model_provider}.env_key 获取
    const modelProvider = data?.model_provider;
    if (modelProvider && data?.model_providers?.[modelProvider]) {
      const providerConfig = data.model_providers[modelProvider];
      if (providerConfig.env_key) {
        return { success: true, envKey: providerConfig.env_key };
      }
      // 也尝试 provider.api_key
      if (providerConfig.api_key) {
        return { success: true, envKey: providerConfig.api_key };
      }
    }

    // 2. 尝试顶层的 env_key/env.key/api_key
    const envKey = data?.env_key || data?.env?.key || data?.api_key;

    if (typeof envKey !== 'string') {
      return { success: false, error: 'env_key not found or not a string' };
    }

    return { success: true, envKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 验证 TOML 文件格式（基础语法检查）
 * @param {string} filePath - 文件路径
 * @returns {{valid: boolean, errors?: Array<string>, raw?: string}}
 */
export function validateToml(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const errors = [];
  const tableStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = i + 1;

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // 检查表格定义 [table]
    if (trimmed.startsWith('[')) {
      if (!trimmed.endsWith(']')) {
        errors.push(`Line ${lineNumber}: Invalid table syntax (missing closing ']')`);
        continue;
      }

      const tableContent = trimmed.slice(1, -1);

      // 检查数组表格 [[array]]
      if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
        const arrayTableName = tableContent.slice(1, -1);
        if (!arrayTableName) {
          errors.push(`Line ${lineNumber}: Empty array table name`);
        }
        continue;
      }

      // 普通表格
      if (!tableContent) {
        errors.push(`Line ${lineNumber}: Empty table name`);
        continue;
      }

      // 检查表格名格式（允许字母、数字、下划线、点）
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(tableContent.replace(/\./g, ''))) {
        errors.push(`Line ${lineNumber}: Invalid table name "${tableContent}"`);
      }

      continue;
    }

    // 检查键值对
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.slice(0, equalIndex).trim();

      // 检查 key 格式
      // 允许 quoted keys ("..." 或 '...')
      const isQuoted = (key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"));
      // 允许 bare keys (字母、数字、下划线、连字符)
      const isBare = /^[A-Za-z0-9_-]+$/.test(key);

      if (!isQuoted && !isBare) {
        errors.push(`Line ${lineNumber}: Invalid key format "${key}"`);
      }

      // 简单检查值的基本格式
      const value = trimmed.slice(equalIndex + 1).trim();

      // 字符串值
      if (value.startsWith('"')) {
        if (!value.endsWith('"')) {
          errors.push(`Line ${lineNumber}: Unterminated string`);
        }
      }
      // 多行字符串
      else if (value.startsWith('"""')) {
        if (!value.endsWith('"""')) {
          // 多行字符串可能跨行，暂不深度检查
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    raw: content
  };
}

/**
 * 比较两个 TOML 文件的差异（基于文本行比较）
 * @param {string} file1 - 第一个文件路径
 * @param {string} file2 - 第二个文件路径
 * @returns {{success: boolean, diff?: string, error?: string}}
 */
export function diffToml(file1, file2) {
  try {
    const content1 = fs.readFileSync(file1, 'utf-8');
    const content2 = fs.readFileSync(file2, 'utf-8');

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    const diff = [];
    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === undefined) {
        diff.push(`+ ${line2}`);
      } else if (line2 === undefined) {
        diff.push(`- ${line1}`);
      } else if (line1 !== line2) {
        diff.push(`- ${line1}`);
        diff.push(`+ ${line2}`);
      } else {
        diff.push(`  ${line1}`);
      }
    }

    return { success: true, diff: diff.join('\n') };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 格式化 TOML 内容（移除多余空行，便于比较）
 * @param {string} content - TOML 文件内容
 * @returns {string} 格式化后的内容
 */
export function formatToml(content) {
  const lines = content.split('\n');
  const result = [];
  let prevEmpty = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!prevEmpty) {
        result.push(line);
      }
      prevEmpty = true;
    } else {
      result.push(line);
      prevEmpty = false;
    }
  }

  return result.join('\n');
}
