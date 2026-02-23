#!/usr/bin/env node
/**
 * StatusLine 脚本 - 显示当前厂商名称
 *
 * 用法: node statusline.js <vendor>
 *
 * Claude Code 会通过 stdin 传递 JSON 数据，但我们只使用命令行参数中的厂商名
 * 以确保多窗口隔离。
 */

import { renderVendor } from '../src/core/statusline.js';

// 从命令行参数获取厂商名
const vendor = process.argv[2];

if (!vendor) {
  // 无参数时显示 UNKNOWN
  console.log('UNKNOWN');
  process.exit(0);
}

// 输出带颜色的厂商名
console.log(renderVendor(vendor));
