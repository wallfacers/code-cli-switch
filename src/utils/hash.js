import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * 计算文件内容的 SHA256 哈希
 * @param {string} filePath
 * @returns {string}
 */
export function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
  } catch {
    return null;
  }
}
