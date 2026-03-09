#!/usr/bin/env node
/**
 * StatusLine 脚本 - 显示厂商名称和上下文使用情况
 *
 * 用法: node statusline.js <vendor>
 *
 * Claude Code 通过 stdin 传递 JSON 数据，命令行参数传递厂商名以确保多窗口隔离。
 */

import { renderVendor, renderStatusBar } from '../src/core/statusline.js';

// 从命令行参数获取厂商名
const vendor = process.argv[2];

if (!vendor) {
  console.log('UNKNOWN');
  process.exit(0);
}

// 从 stdin 读取 JSON 数据
let inputData = '';
let finished = false;

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  if (finished) return;
  finished = true;

  // 尝试解析 JSON
  let contextData = null;
  let cwd = null;
  let model = null;
  let status = null;

  if (inputData.trim()) {
    try {
      const parsed = JSON.parse(inputData);
      contextData = parsed.context_window || null;
      cwd = parsed.cwd || null;
      model = parsed.model || null;
      status = parsed.status || null;
    } catch (e) {
      // JSON 解析失败，使用回退显示
    }
  }

  // 如果没有 context_data，回退到简单显示
  if (!contextData) {
    console.log(renderVendor(vendor));
  } else {
    console.log(renderStatusBar(vendor, contextData, cwd, model, status));
  }
});

// 设置超时，防止 stdin 无数据时阻塞
setTimeout(() => {
  if (finished) return;
  finished = true;
  console.log(renderVendor(vendor));
}, 100);
