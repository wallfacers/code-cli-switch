#!/usr/bin/env node

/**
 * Cross-platform Claude ConfigChange blocker
 * Works on macOS / Linux / Windows
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// 转义日志中的特殊字符，防止日志注入
function sanitizeForLog(str) {
  if (typeof str !== "string") {
    return String(str);
  }
  // 替换可能导致日志注入的特殊字符
  return str
    .replace(/[\r\n\t]/g, (match) => {
      const escapeMap = { "\r": "\\r", "\n": "\\n", "\t": "\\t" };
      return escapeMap[match];
    })
    .replace(/[\x00-\x1F\x7F]/g, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

// 读取 stdin
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", chunk => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      resolve(data);
    });
  });
}

(async () => {
  try {
    const inputRaw = await readStdin();
    const input = inputRaw ? JSON.parse(inputRaw) : {};

    const filePath = input.file_path || "unknown";
    const safeFilePath = sanitizeForLog(filePath);

    // 构造日志目录
    const homeDir = os.homedir();
    const logDir = path.join(homeDir, ".claude", "logs");
    const logFile = path.join(logDir, "blocked-changes.log");

    // 确保目录存在
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (mkdirErr) {
      // 记录目录创建失败但继续执行，不影响 block 决策
      console.error(`[block-user-settings-change] Failed to create log directory: ${mkdirErr.message}`);
    }

    // 写入日志
    try {
      const logLine = `[${new Date().toISOString()}] Blocked settings change: ${safeFilePath}${os.EOL}`;
      fs.appendFileSync(logFile, logLine);
    } catch (writeErr) {
      // 记录日志写入失败但继续执行，不影响 block 决策
      console.error(`[block-user-settings-change] Failed to write to log file: ${writeErr.message}`);
    }

  } catch (err) {
    // 记录错误但不影响 hook 返回，确保 hook 始终返回 block 决策
    console.error(`[block-user-settings-change] Unexpected error: ${err.message}`);
  }

  // 返回 block 决策
  const response = {
    decision: "block",
    reason: "Settings changes are currently blocked for review"
  };

  process.stdout.write(JSON.stringify(response));
  process.exit(0);
})();
