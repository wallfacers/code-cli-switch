#!/usr/bin/env node

/**
 * Cross-platform Claude ConfigChange blocker
 * Works on macOS / Linux / Windows
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

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

    // 构造日志目录
    const homeDir = os.homedir();
    const logDir = path.join(homeDir, ".claude", "logs");
    const logFile = path.join(logDir, "blocked-changes.log");

    // 确保目录存在
    fs.mkdirSync(logDir, { recursive: true });

    // 写入日志
    const logLine = `[${new Date().toISOString()}] Blocked settings change: ${filePath}${os.EOL}`;
    fs.appendFileSync(logFile, logLine);

  } catch (err) {
    // 即使出错也不能影响 hook 返回
  }

  // 返回 block 决策
  const response = {
    decision: "block",
    reason: "Settings changes are currently blocked for review"
  };

  process.stdout.write(JSON.stringify(response));
  process.exit(0);
})();
