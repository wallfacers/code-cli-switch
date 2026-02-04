import fs from 'node:fs';
import { getStatePath } from './path.js';
import { formatDate } from './date.js';

const DEFAULT_STATE = {
  current: null,
  current_hash: null,
  last_switch: null,
  history: []
};

/**
 * 读取 state.json
 * @returns {object}
 */
export function readState() {
  try {
    const content = fs.readFileSync(getStatePath(), 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(content) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * 写入 state.json
 * @param {object} state
 */
export function writeState(state) {
  fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * 更新当前配置信息
 * @param {string} variant - 配置变体名称
 * @param {string} hash - 文件内容哈希
 */
export function updateCurrentState(variant, hash = null) {
  const state = readState();
  const now = formatDate();

  // 记录历史
  if (state.current) {
    state.history.push({
      variant: state.current,
      switched_at: state.last_switch
    });
    // 只保留最近 50 条记录
    if (state.history.length > 50) {
      state.history = state.history.slice(-50);
    }
  }

  state.current = variant;
  state.current_hash = hash;
  state.last_switch = now;

  writeState(state);
  return state;
}

/**
 * 清空状态
 */
export function clearState() {
  writeState(DEFAULT_STATE);
}
