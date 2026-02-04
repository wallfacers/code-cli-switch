/**
 * 日期时间工具函数
 * 统一使用东八区（UTC+8）时间
 */

/**
 * 获取东八区时间对象
 * @returns {Date}
 */
function getChinaTimeZoneDate() {
  // 创建当前时间
  const now = new Date();
  // 获取 UTC 时间戳
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  // 东八区（UTC+8）
  return new Date(utc + (8 * 3600000));
}

/**
 * 格式化东八区时间为 ISO 风格格式
 * @returns {string} 格式: YYYY-MM-DD HH:mm:ss
 */
export function formatDate() {
  const date = getChinaTimeZoneDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化东八区时间为紧凑时间戳
 * @returns {string} 格式: YYYYMMDDHHMMSS
 */
export function formatTimestamp() {
  const date = getChinaTimeZoneDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * 将 Date 对象转换为东八区时间字符串
 * @param {Date} date - Date 对象
 * @returns {string} 格式: YYYY-MM-DD HH:mm:ss
 */
export function toChinaTimeZoneString(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const chinaDate = new Date(utc + (8 * 3600000));
  const year = chinaDate.getFullYear();
  const month = String(chinaDate.getMonth() + 1).padStart(2, '0');
  const day = String(chinaDate.getDate()).padStart(2, '0');
  const hours = String(chinaDate.getHours()).padStart(2, '0');
  const minutes = String(chinaDate.getMinutes()).padStart(2, '0');
  const seconds = String(chinaDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
