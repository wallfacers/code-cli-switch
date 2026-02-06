import fs from 'node:fs';

/**
 * 平台相关的原子替换
 * Windows: 先删除目标文件，然后重命名
 * Unix: rename() 系统调用（原子）
 * @param {string} sourcePath - 源文件路径
 * @param {string} targetPath - 目标文件路径
 */
export function atomicReplace(sourcePath, targetPath) {
  if (process.platform === 'win32') {
    // Windows: 先删除目标文件（如果存在），然后重命名
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(sourcePath, targetPath);
  } else {
    // Unix: rename() 系统调用是原子的
    fs.renameSync(sourcePath, targetPath);
  }
}

/**
 * 安全的原子切换流程
 * 1. 复制源文件到临时文件
 * 2. 原子性替换目标文件
 * 3. 失败时清理临时文件
 * @param {string} sourcePath - 源文件路径
 * @param {string} targetPath - 目标文件路径
 */
export function atomicSwitch(sourcePath, targetPath) {
  const tempPath = `${targetPath}.tmp.${Date.now()}`;

  // 复制到临时文件
  fs.copyFileSync(sourcePath, tempPath);

  try {
    // 原子替换
    atomicReplace(tempPath, targetPath);
  } catch (error) {
    // 失败时清理临时文件
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}
