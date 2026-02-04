import fs from 'node:fs';

/**
 * 验证 .env 文件格式
 * @param {string} filePath - 文件路径
 * @returns {{valid: boolean, errors?: Array<string>, data?: object}}
 */
export function validateEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const errors = [];
  const data = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = i + 1;

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // 检查是否包含等号
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      errors.push(`Line ${lineNumber}: Invalid format (missing '=')`);
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();

    // 检查 key 格式（允许字母、数字、下划线，建议大写）
    if (!key) {
      errors.push(`Line ${lineNumber}: Empty key`);
      continue;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      errors.push(`Line ${lineNumber}: Invalid key format "${key}" (only letters, numbers, and underscores allowed)`);
      continue;
    }

    // 处理带引号的值
    let parsedValue = value;
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      parsedValue = value.slice(1, -1);
    }

    data[key] = parsedValue;
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    data
  };
}

/**
 * 解析 .env 文件
 * @param {string} filePath - 文件路径
 * @returns {object}
 */
export function parseEnv(filePath) {
  const validation = validateEnv(filePath);
  return validation.data || {};
}

/**
 * 将对象转换为 .env 格式字符串
 * @param {object} data - 键值对对象
 * @returns {string}
 */
export function stringifyEnv(data) {
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && (value.includes(' ') || value.includes('#') || value.includes('"'))) {
      lines.push(`${key}="${value}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  return lines.join('\n');
}

/**
 * 比较两个 .env 文件的差异
 * @param {string} file1 - 第一个文件路径
 * @param {string} file2 - 第二个文件路径
 * @returns {{success: boolean, diff?: string, error?: string}}
 */
export function diffEnv(file1, file2) {
  try {
    const data1 = parseEnv(file1);
    const data2 = parseEnv(file2);

    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);
    const diff = [];

    for (const key of Array.from(allKeys).sort()) {
      const val1 = data1[key];
      const val2 = data2[key];

      if (val1 === undefined) {
        diff.push(`+ ${key}=${val2}`);
      } else if (val2 === undefined) {
        diff.push(`- ${key}=${val1}`);
      } else if (val1 !== val2) {
        diff.push(`- ${key}=${val1}`);
        diff.push(`+ ${key}=${val2}`);
      } else {
        diff.push(`  ${key}=${val1}`);
      }
    }

    return { success: true, diff: diff.join('\n') };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 格式化 .env 内容（排序键值对，便于比较）
 * @param {string} content - .env 文件内容
 * @returns {string} 格式化后的内容
 */
export function formatEnv(content) {
  const data = {};
  const lines = [];

  // 解析时保留注释
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.slice(0, equalIndex).trim();
      const value = trimmed.slice(equalIndex + 1).trim();
      data[key] = { value, originalLine: line };
    }
  }

  // 按键排序输出
  for (const key of Object.keys(data).sort()) {
    lines.push(`${key}=${data[key].value}`);
  }

  return lines.join('\n');
}
