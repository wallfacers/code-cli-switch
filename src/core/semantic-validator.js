/**
 * Claude 配置的语义验证
 * @param {object} data - 解析后的 JSON 数据
 * @returns {{valid: boolean, errors: Array<string>, warnings: Array<string>}}
 */
export function validateClaudeSemantic(data) {
  const errors = [];
  const warnings = [];

  // 必需字段：api_key 或 providers 配置
  if (!data.api_key && !data.providers?.length) {
    errors.push('Missing required field: api_key or providers');
  }

  // 可选字段验证
  if (data.model !== undefined && typeof data.model !== 'string') {
    errors.push('Field "model" must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gemini (.env) 配置的语义验证
 * @param {object} data - 解析后的 ENV 数据
 * @returns {{valid: boolean, errors: Array<string>, warnings: Array<string>}}
 */
export function validateGeminiSemantic(data) {
  const errors = [];

  // 检查必需的 API 密钥
  if (!data.GEMINI_API_KEY && !data.API_KEY) {
    errors.push('Missing required field: GEMINI_API_KEY or API_KEY');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}

/**
 * Codex (TOML) 配置的语义验证
 * @param {object} data - 解析后的 TOML 数据
 * @returns {{valid: boolean, errors: Array<string>, warnings: Array<string>}}
 */
export function validateCodexSemantic(data) {
  const errors = [];

  // 检查 env_key 或 api_key
  if (!data.env_key && !data.api_key) {
    errors.push('Missing required field: env_key or api_key');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}

/**
 * 统一的语义验证入口
 * @param {string} service - 服务标识
 * @param {object} data - 配置数据
 * @returns {{valid: boolean, errors: Array<string>, warnings: Array<string>}}
 */
export function validateSemantic(service, data) {
  const validators = {
    claude: validateClaudeSemantic,
    gemini: validateGeminiSemantic,
    codex: validateCodexSemantic
  };

  const validator = validators[service];
  if (!validator) {
    // 未知服务跳过验证
    return { valid: true, errors: [], warnings: [] };
  }

  return validator(data);
}
