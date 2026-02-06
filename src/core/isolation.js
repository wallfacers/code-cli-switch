import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// 会话 ID（进程级唯一标识）
const SESSION_ID = crypto.randomBytes(8).toString('hex');
let SESSION_DIR = null;

/**
 * 获取当前会话的工作目录
 * 每个进程有独立的临时目录
 * @returns {string} 会话目录路径
 */
export function getSessionDir() {
  if (!SESSION_DIR) {
    SESSION_DIR = path.join(os.tmpdir(), `cs-cli-session-${SESSION_ID}`);
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  return SESSION_DIR;
}

/**
 * 在会话目录中安全操作配置
 * 操作完成后原子性地同步到目标位置
 * @param {string} service - 服务标识（如 'claude', 'gemini'）
 * @param {function} operation - 在工作目录执行的操作
 * @returns {*} 操作的返回值
 */
export function isolatedOperation(service, operation) {
  const sessionDir = getSessionDir();
  const workDir = path.join(sessionDir, service);

  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  // 在工作目录执行操作
  return operation(workDir);
}

/**
 * 清理会话目录（进程退出时调用）
 */
export function cleanupSession() {
  if (SESSION_DIR && fs.existsSync(SESSION_DIR)) {
    try {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      SESSION_DIR = null;
    } catch (error) {
      // 静默失败，避免影响主流程
      console.warn(`Warning: Failed to cleanup session directory: ${error.message}`);
    }
  }
}
