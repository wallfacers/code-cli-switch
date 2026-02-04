import fs from 'node:fs';

/**
 * JSON 语法校验
 * @param {string} filePath
 * @returns {object} { valid: boolean, error?: string, data?: object }
 */
export function validateJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return { valid: true, data };
  } catch (error) {
    let errorMsg = error.message;

    // 提取更友好的错误位置
    if (error.message.includes('position')) {
      const match = error.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1], 10);
        const content = fs.readFileSync(filePath, 'utf-8');
        const line = content.substring(0, pos).split('\n').length;
        const col = pos - content.lastIndexOf('\n', pos - 1);
        errorMsg = `Syntax error at line ${line}, column ${col}`;
      }
    }

    return { valid: false, error: errorMsg };
  }
}

/**
 * 检查文件是否存在
 * @param {string} filePath
 * @returns {boolean}
 */
export function fileExists(filePath) {
  return fs.existsSync(filePath);
}
