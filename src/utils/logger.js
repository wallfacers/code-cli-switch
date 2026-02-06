import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Allow override via environment variable for testing
const AUDIT_LOG_PATH = process.env.CS_CLI_AUDIT_LOG_PATH || path.join(os.homedir(), '.cs-cli', 'audit.log');

/**
 * 记录审计日志
 * @param {object} event - 事件对象
 */
export function logAudit(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    pid: process.pid,
    event
  };

  ensureAuditDir();
  const line = JSON.stringify(entry) + '\n';

  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch (error) {
    // 静默失败，不影响主流程
  }
}

/**
 * 读取审计日志
 * @param {object} options - { service: string, action: string, limit: number }
 * @returns {Array<object>}
 */
export function readAuditLog(options = {}) {
  if (!fs.existsSync(AUDIT_LOG_PATH)) {
    return [];
  }

  const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
  const entries = content.split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let filtered = entries;

  if (options.service) {
    filtered = filtered.filter(e => e.event.service === options.service);
  }

  if (options.action) {
    filtered = filtered.filter(e => e.event.action === options.action);
  }

  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

/**
 * 格式化审计日志输出
 * @param {Array} entries - 日志条目
 * @returns {string}
 */
export function formatAuditLog(entries) {
  return entries.map(entry => {
    const date = new Date(entry.timestamp).toLocaleString();
    const event = entry.event;
    return `[${date}] ${event.action} ${event.service || ''} ${event.variant || ''}`;
  }).join('\n');
}

/**
 * 确保审计日志目录存在
 */
function ensureAuditDir() {
  const dir = path.dirname(AUDIT_LOG_PATH);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // 忽略错误
    }
  }
}

/**
 * 记录切换操作
 */
export function logSwitch(service, variant, success) {
  logAudit({
    action: 'switch',
    service,
    variant,
    success,
    cwd: process.cwd()
  });
}

/**
 * 记录备份操作
 */
export function logBackup(service, timestamp) {
  logAudit({
    action: 'backup',
    service,
    timestamp
  });
}

/**
 * 记录恢复操作
 */
export function logRestore(service, fromTimestamp) {
  logAudit({
    action: 'restore',
    service,
    from: fromTimestamp
  });
}
