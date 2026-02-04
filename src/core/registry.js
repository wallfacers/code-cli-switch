import { ClaudeAdapter } from './services/claude.js';
import { GeminiAdapter } from './services/gemini.js';
import { CodexAdapter } from './services/codex.js';

/**
 * 服务注册表
 */
const adapters = new Map();

// 注册默认服务
adapters.set('claude', new ClaudeAdapter());
adapters.set('gemini', new GeminiAdapter());
adapters.set('codex', new CodexAdapter());

// 兼容性别名：默认使用 claude
adapters.set('default', adapters.get('claude'));

/**
 * 获取服务适配器
 * @param {string} serviceId - 服务标识
 * @returns {ServiceAdapter|null}
 */
export function getAdapter(serviceId) {
  return adapters.get(serviceId) || null;
}

/**
 * 获取所有已注册的服务
 * @returns {Array<{id: string, name: string}>}
 */
export function listServices() {
  const result = [];
  for (const [id, adapter] of adapters.entries()) {
    if (id === 'default') continue; // 跳过别名
    result.push({ id, name: adapter.name });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 检查服务是否存在
 * @param {string} serviceId
 * @returns {boolean}
 */
export function hasService(serviceId) {
  return adapters.has(serviceId);
}

/**
 * 注册新的服务适配器
 * @param {string} serviceId
 * @param {ServiceAdapter} adapter
 */
export function registerAdapter(serviceId, adapter) {
  adapters.set(serviceId, adapter);
}
