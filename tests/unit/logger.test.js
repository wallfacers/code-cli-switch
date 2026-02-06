import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Module path for logger
const LOGGER_PATH = path.resolve(__dirname, '../../src/utils/logger.js');

// Helper function to create a fresh test environment
function createFreshLogger() {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-audit-'));
  const logFilePath = path.join(testDir, 'audit.log');
  const originalEnv = process.env.CS_CLI_AUDIT_LOG_PATH;

  // Set environment variable before clearing cache
  process.env.CS_CLI_AUDIT_LOG_PATH = logFilePath;

  // Clear module cache to force re-import
  delete require.cache[require.resolve(LOGGER_PATH)];

  const logger = require(LOGGER_PATH);

  return {
    testDir,
    logFilePath,
    originalEnv,
    logger,
    cleanup: () => {
      // First restore the environment
      if (originalEnv === undefined) {
        delete process.env.CS_CLI_AUDIT_LOG_PATH;
      } else {
        process.env.CS_CLI_AUDIT_LOG_PATH = originalEnv;
      }
      // Then clear the module cache
      delete require.cache[require.resolve(LOGGER_PATH)];
      // Finally clean up the test directory
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }
  };
}

describe('audit logger', () => {
  describe('log audit events', () => {
    let testEnv;

    beforeEach(() => {
      testEnv = createFreshLogger();
    });

    afterEach(() => {
      testEnv.cleanup();
    });

    it('should log audit events', () => {
      testEnv.logger.logAudit({ action: 'test', data: 'value' });

      const logs = testEnv.logger.readAuditLog();
      expect(logs.length).toBe(1);
      expect(logs[0].event.action).toBe('test');
    });
  });

  describe('log switch events', () => {
    let testEnv;

    beforeEach(() => {
      testEnv = createFreshLogger();
    });

    afterEach(() => {
      testEnv.cleanup();
    });

    it('should log switch events', () => {
      testEnv.logger.logSwitch('claude', 'openai', true);

      const logs = testEnv.logger.readAuditLog();
      expect(logs.length).toBe(1);
      expect(logs[0].event.action).toBe('switch');
      expect(logs[0].event.service).toBe('claude');
    });
  });

  describe('filter logs', () => {
    let testEnv;

    beforeEach(() => {
      testEnv = createFreshLogger();
    });

    afterEach(() => {
      testEnv.cleanup();
    });

    it('should filter logs by service', () => {
      testEnv.logger.logSwitch('claude', 'openai', true);
      testEnv.logger.logSwitch('gemini', 'prod', true);

      const allLogs = testEnv.logger.readAuditLog();

      const claudeLogs = testEnv.logger.readAuditLog({ service: 'claude' });
      const geminiLogs = testEnv.logger.readAuditLog({ service: 'gemini' });

      // Verify filtering works - we expect at least 1 for each
      expect(claudeLogs.length).toBeGreaterThanOrEqual(1);
      if (claudeLogs.length > 0) {
        expect(claudeLogs[0].event.service).toBe('claude');
      }

      expect(geminiLogs.length).toBeGreaterThanOrEqual(1);
      if (geminiLogs.length > 0) {
        expect(geminiLogs[0].event.service).toBe('gemini');
      }

      // Additional verification: the total should be at least 2
      expect(allLogs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('limit log entries', () => {
    let testEnv;

    beforeEach(() => {
      testEnv = createFreshLogger();
    });

    afterEach(() => {
      testEnv.cleanup();
    });

    it('should limit log entries', () => {
      for (let i = 0; i < 20; i++) {
        testEnv.logger.logAudit({ action: `test-${i}` });
      }

      const logs = testEnv.logger.readAuditLog({ limit: 5 });
      expect(logs.length).toBe(5);
    });
  });

  describe('format audit log', () => {
    let testEnv;

    beforeEach(() => {
      testEnv = createFreshLogger();
    });

    afterEach(() => {
      testEnv.cleanup();
    });

    it('should format audit log', () => {
      testEnv.logger.logSwitch('claude', 'openai', true);
      const logs = testEnv.logger.readAuditLog();
      const formatted = testEnv.logger.formatAuditLog(logs);

      expect(formatted).toContain('switch');
      expect(formatted).toContain('claude');
    });
  });
});
