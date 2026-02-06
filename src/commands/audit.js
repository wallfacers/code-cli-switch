import { readAuditLog, formatAuditLog } from '../utils/logger.js';
import chalk from 'chalk';

/**
 * 查看审计日志
 * @param {object} options - { service: string, action: string, limit: string }
 */
export function auditLogCommand(options = {}) {
  const { service, action, limit } = options;

  const entries = readAuditLog({
    service,
    action,
    limit: parseInt(limit) || 10
  });

  if (entries.length === 0) {
    console.log(chalk.yellow('No audit log entries found'));
    return;
  }

  console.log(chalk.cyan('\n📋 Audit Log:\n'));
  console.log(formatAuditLog(entries));
  console.log();
}
