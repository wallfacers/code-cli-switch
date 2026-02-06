# cs-cli Comprehensive Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 全面改进 cs-cli 工具，包括原子操作、进程隔离、语义验证、测试覆盖、init 命令、错误信息改进、交互恢复、撤销功能、Shell 补全、配置预览和审计日志。

**Architecture:** 分阶段实施，每个阶段独立可测试。新增原子操作模块和进程隔离模块确保并发安全，语义验证模块确保配置有效性，测试覆盖所有新增功能。

**Tech Stack:** Node.js >=18, vitest, @inquirer/prompts, chalk, commander, smol-toml

---

## Phase 1: 基础设施（高优先级）

### Task 1.1: Create atomic operation module

**Files:**
- Create: `src/core/atomic.js`
- Test: `tests/unit/atomic.test.js`

**Step 1: Write the failing test**

Create `tests/unit/atomic.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { atomicReplace, atomicSwitch } from '../../src/core/atomic.js';

describe('atomic operations', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should replace file atomically', () => {
    const source = path.join(tmpDir, 'source.txt');
    const target = path.join(tmpDir, 'target.txt');

    fs.writeFileSync(source, 'new content');
    fs.writeFileSync(target, 'old content');

    atomicReplace(source, target);

    expect(fs.readFileSync(target, 'utf-8')).toBe('new content');
    expect(fs.existsSync(source)).toBe(false);
  });

  it('should handle non-existent target', () => {
    const source = path.join(tmpDir, 'source.txt');
    const target = path.join(tmpDir, 'target.txt');

    fs.writeFileSync(source, 'content');

    atomicReplace(source, target);

    expect(fs.readFileSync(target, 'utf-8')).toBe('content');
  });

  it('should perform atomic switch with temp file cleanup', () => {
    const source = path.join(tmpDir, 'source.txt');
    const target = path.join(tmpDir, 'target.txt');

    fs.writeFileSync(source, 'content');

    atomicSwitch(source, target);

    expect(fs.readFileSync(target, 'utf-8')).toBe('content');
    expect(fs.existsSync(source)).toBe(true); // source still exists
    expect(fs.existsSync(`${target}.tmp`)).toBe(false); // temp file cleaned
  });

  it('should clean up temp file on failure', () => {
    const source = path.join(tmpDir, 'source.txt');
    const target = path.join(tmpDir, 'nonexistent', 'target.txt');

    fs.writeFileSync(source, 'content');

    expect(() => atomicSwitch(source, target)).toThrow();
    // Check no temp files left
    const files = fs.readdirSync(tmpDir);
    expect(files.filter(f => f.startsWith('target.txt.tmp'))).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/atomic.test.js`
Expected: FAIL with "Cannot find package '../../src/core/atomic.js'"

**Step 3: Write minimal implementation**

Create `src/core/atomic.js`:

```javascript
import fs from 'node:fs';

/**
 * 平台相关的原子替换
 * Windows: 先删除目标文件，然后重命名
 * Unix: rename() 系统调用（原子）
 * @param {string} sourcePath - 源文件路径
 * @param {string} targetPath - 目标文件路径
 */
export function atomicReplace(sourcePath, targetPath) {
  if (process.platform === 'win32') {
    // Windows: 先删除目标文件（如果存在），然后重命名
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(sourcePath, targetPath);
  } else {
    // Unix: rename() 系统调用是原子的
    fs.renameSync(sourcePath, targetPath);
  }
}

/**
 * 安全的原子切换流程
 * 1. 复制源文件到临时文件
 * 2. 原子性替换目标文件
 * 3. 失败时清理临时文件
 * @param {string} sourcePath - 源文件路径
 * @param {string} targetPath - 目标文件路径
 */
export function atomicSwitch(sourcePath, targetPath) {
  const tempPath = `${targetPath}.tmp.${Date.now()}`;

  // 复制到临时文件
  fs.copyFileSync(sourcePath, tempPath);

  try {
    // 原子替换
    atomicReplace(tempPath, targetPath);
  } catch (error) {
    // 失败时清理临时文件
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/atomic.test.js`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add tests/unit/atomic.test.js src/core/atomic.js
git commit -m "feat: add atomic operation module"
```

---

### Task 1.2: Create process isolation module

**Files:**
- Create: `src/core/isolation.js`
- Test: `tests/unit/isolation.test.js`

**Step 1: Write the failing test**

Create `tests/unit/isolation.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getSessionDir, isolatedOperation, cleanupSession } from '../../src/core/isolation.js';

describe('process isolation', () => {
  afterEach(() => {
    cleanupSession();
  });

  it('should create and return session directory', () => {
    const sessionDir = getSessionDir();

    expect(sessionDir).toBeTruthy();
    expect(fs.existsSync(sessionDir)).toBe(true);
    expect(sessionDir).toContain('cs-cli-session-');
  });

  it('should return same session directory on multiple calls', () => {
    const dir1 = getSessionDir();
    const dir2 = getSessionDir();

    expect(dir1).toBe(dir2);
  });

  it('should create service-specific work directory', () => {
    const workDir = isolatedOperation('claude', (dir) => {
      expect(fs.existsSync(dir)).toBe(true);
      expect(dir).toContain('claude');
      return dir;
    });

    expect(workDir).toContain('claude');
  });

  it('should execute operation in isolated directory', () => {
    const testFile = isolatedOperation('test', (dir) => {
      const filePath = path.join(dir, 'test.txt');
      fs.writeFileSync(filePath, 'test content');
      return filePath;
    });

    expect(fs.existsSync(testFile)).toBe(true);
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('test content');
  });

  it('should clean up session directory', () => {
    const sessionDir = getSessionDir();
    expect(fs.existsSync(sessionDir)).toBe(true);

    cleanupSession();

    expect(fs.existsSync(sessionDir)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/isolation.test.js`
Expected: FAIL with "Cannot find package '../../src/core/isolation.js'"

**Step 3: Write minimal implementation**

Create `src/core/isolation.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// 会话 ID（进程级唯一标识）
const SESSION_ID = crypto.randomBytes(8).toString('hex');
let SESSION_DIR = null;

/**
 * 获取当前会话的工作目录
 * 每个进程有独立的临时目录
 * @returns {string} 会话目录路径
 */
export function getSessionDir() {
  if (!SESSION_DIR) {
    SESSION_DIR = path.join(os.tmpdir(), `cs-cli-session-${SESSION_ID}`);
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  return SESSION_DIR;
}

/**
 * 在会话目录中安全操作配置
 * 操作完成后原子性地同步到目标位置
 * @param {string} service - 服务标识（如 'claude', 'gemini'）
 * @param {function} operation - 在工作目录执行的操作
 * @returns {*} 操作的返回值
 */
export function isolatedOperation(service, operation) {
  const sessionDir = getSessionDir();
  const workDir = path.join(sessionDir, service);

  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  // 在工作目录执行操作
  return operation(workDir);
}

/**
 * 清理会话目录（进程退出时调用）
 */
export function cleanupSession() {
  if (SESSION_DIR && fs.existsSync(SESSION_DIR)) {
    try {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      SESSION_DIR = null;
    } catch (error) {
      // 静默失败，避免影响主流程
      console.warn(`Warning: Failed to cleanup session directory: ${error.message}`);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/isolation.test.js`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add tests/unit/isolation.test.js src/core/isolation.js
git commit -m "feat: add process isolation module"
```

---

### Task 1.3: Create semantic validation module

**Files:**
- Create: `src/core/semantic-validator.js`
- Test: `tests/unit/semantic-validator.test.js`

**Step 1: Write the failing test**

Create `tests/unit/semantic-validator.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  validateClaudeSemantic,
  validateGeminiSemantic,
  validateCodexSemantic,
  validateSemantic
} from '../../src/core/semantic-validator.js';

describe('semantic validation', () => {
  describe('Claude config', () => {
    it('should validate config with api_key', () => {
      const result = validateClaudeSemantic({
        api_key: 'sk-ant-test',
        model: 'claude-sonnet-4'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate config with providers', () => {
      const result = validateClaudeSemantic({
        providers: [{ name: 'openai', api_key: 'sk-test' }]
      });
      expect(result.valid).toBe(true);
    });

    it('should reject config without api_key or providers', () => {
      const result = validateClaudeSemantic({
        model: 'claude-sonnet-4'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: api_key or providers');
    });

    it('should reject invalid model type', () => {
      const result = validateClaudeSemantic({
        api_key: 'sk-ant-test',
        model: 123
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "model" must be a string');
    });
  });

  describe('Gemini config', () => {
    it('should validate config with GEMINI_API_KEY', () => {
      const result = validateGeminiSemantic({
        GEMINI_API_KEY: 'AIza-test'
      });
      expect(result.valid).toBe(true);
    });

    it('should validate config with API_KEY', () => {
      const result = validateGeminiSemantic({
        API_KEY: 'AIza-test'
      });
      expect(result.valid).toBe(true);
    });

    it('should reject config without API key', () => {
      const result = validateGeminiSemantic({
        MODEL: 'gemini-pro'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: GEMINI_API_KEY or API_KEY');
    });
  });

  describe('Codex config', () => {
    it('should validate config with env_key', () => {
      const result = validateCodexSemantic({
        env_key: 'sk-test',
        base_url: 'https://api.openai.com/v1'
      });
      expect(result.valid).toBe(true);
    });

    it('should validate config with api_key', () => {
      const result = validateCodexSemantic({
        api_key: 'sk-test'
      });
      expect(result.valid).toBe(true);
    });

    it('should reject config without env_key or api_key', () => {
      const result = validateCodexSemantic({
        base_url: 'https://api.openai.com/v1'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: env_key or api_key');
    });
  });

  describe('validateSemantic unified function', () => {
    it('should delegate to correct validator for claude', () => {
      const result = validateSemantic('claude', { api_key: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should delegate to correct validator for gemini', () => {
      const result = validateSemantic('gemini', { GEMINI_API_KEY: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should delegate to correct validator for codex', () => {
      const result = validateSemantic('codex', { env_key: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should return valid for unknown service', () => {
      const result = validateSemantic('unknown', {});
      expect(result.valid).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/semantic-validator.test.js`
Expected: FAIL with "Cannot find package '../../src/core/semantic-validator.js'"

**Step 3: Write minimal implementation**

Create `src/core/semantic-validator.js`:

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/semantic-validator.test.js`
Expected: PASS (13 tests)

**Step 5: Commit**

```bash
git add tests/unit/semantic-validator.test.js src/core/semantic-validator.js
git commit -m "feat: add semantic validation module"
```

---

### Task 1.4: Refactor switcher.js to use atomic and isolation modules

**Files:**
- Modify: `src/core/switcher.js:1-143`
- Test: `tests/integration/switch-flow.test.js`

**Step 1: Write the failing test**

Create `tests/integration/switch-flow.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { switchConfig } from '../../src/core/switcher.js';

describe('switch flow integration', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-switch-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = testDir;

    // 创建测试配置文件
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'settings.json'),
      JSON.stringify({ api_key: 'sk-default', model: 'default' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.openai'),
      JSON.stringify({ api_key: 'sk-openai', model: 'gpt-4' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.local'),
      JSON.stringify({ api_key: 'sk-local', model: 'local' })
    );
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should switch configuration successfully', () => {
    const result = switchConfig('claude', 'openai');

    expect(result.success).toBe(true);
    expect(result.variant).toBe('openai');

    const currentContent = fs.readFileSync(path.join(testDir, 'settings.json'), 'utf-8');
    const currentData = JSON.parse(currentContent);
    expect(currentData.api_key).toBe('sk-openai');
  });

  it('should create backup before switching', () => {
    const result = switchConfig('claude', 'openai');

    expect(result.success).toBe(true);
    expect(result.backup).toBeTruthy();

    // 检查备份目录
    const backupDir = path.join(testDir, '.cs-backups');
    expect(fs.existsSync(backupDir)).toBe(true);
  });

  it('should support dry-run mode', () => {
    const result = switchConfig('claude', 'openai', { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);

    // 配置不应改变
    const currentContent = fs.readFileSync(path.join(testDir, 'settings.json'), 'utf-8');
    const currentData = JSON.parse(currentContent);
    expect(currentData.api_key).toBe('sk-default');
  });

  it('should handle non-existent variant', () => {
    const result = switchConfig('claude', 'nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should validate JSON format before switching', () => {
    // 创建无效的 JSON 文件
    fs.writeFileSync(
      path.join(testDir, 'settings.json.invalid'),
      '{ invalid json }'
    );

    const result = switchConfig('claude', 'invalid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid format');
  });
});
```

**Step 2: Run test to verify current state**

Run: `npm test tests/integration/switch-flow.test.js`
Expected: PASS (existing implementation should work, but we're adding isolation)

**Step 3: Refactor switcher.js**

Modify `src/core/switcher.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { getAdapter } from './registry.js';
import { fileHash } from '../utils/hash.js';
import { createBackup as createBackupForService } from './backup.js';
import { atomicSwitch } from './atomic.js';
import { isolatedOperation, cleanupSession } from './isolation.js';

/**
 * 切换到指定配置
 * @param {string} service - 服务标识 (claude/gemini/codex)，默认为 claude
 * @param {string} variant - 配置变体名称
 * @param {object} options - { dryRun: boolean, noBackup: boolean }
 * @returns {object}
 */
export function switchConfig(service, variant, options = {}) {
  // 兼容旧接口：如果第二个参数是对象，说明 service 未传递
  if (typeof variant === 'object') {
    options = variant;
    variant = service;
    service = 'claude';
  }

  const { dryRun = false, noBackup = false } = options;

  const adapter = getAdapter(service);
  if (!adapter) {
    return {
      success: false,
      error: `Unknown coding tool: "${service}"`,
      suggestions: listAvailableServices()
    };
  }

  const sourcePath = adapter.getVariantPath(variant);
  const targetPath = adapter.getTargetPath();

  // 1. 检查目标文件是否存在
  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      error: `Configuration variant "${variant}" not found`,
      suggestions: listAvailableVariants(adapter)
    };
  }

  // 2. 格式校验
  const validation = adapter.validate(sourcePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';

    return {
      success: false,
      error: `Invalid format in ${adapter.getBaseName()}.${variant}: ${errorMsg}`
    };
  }

  // Dry-run 模式只验证，不执行
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      service,
      message: `Would switch ${service} to "${variant}"`,
      source: sourcePath,
      target: targetPath
    };
  }

  // 3. 备份当前配置
  let backupResult = null;
  if (fs.existsSync(targetPath) && !noBackup) {
    backupResult = createBackupForService(service);
    if (!backupResult.success) {
      return {
        success: false,
        error: `Failed to create backup: ${backupResult.error}`
      };
    }
  }

  try {
    // 4. 使用进程隔离 + 原子操作进行切换
    isolatedOperation(service, (workDir) => {
      const tempPath = path.join(workDir, adapter.getBaseName());

      // 在会话目录准备文件
      fs.copyFileSync(sourcePath, tempPath);

      // 原子替换到目标位置
      atomicSwitch(tempPath, targetPath);
    });

    // 5. 计算哈希并更新状态
    const hash = fileHash(targetPath);
    adapter.writeState(variant, hash);

    // 6. Codex 特殊处理：更新 auth.json
    if (service === 'codex' && typeof adapter.updateAuthJson === 'function') {
      const authResult = adapter.updateAuthJson(targetPath);
      if (!authResult.success) {
        // auth.json 更新失败不影响主流程，但记录警告
        console.warn(`Warning: Failed to update auth.json: ${authResult.error}`);
      }
    }

    return {
      success: true,
      service,
      variant,
      backup: backupResult?.timestamp || null,
      message: `Switched ${service} to "${variant}"`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to switch: ${error.message}`
    };
  } finally {
    // 确保清理会话
    cleanupSession();
  }
}

/**
 * 预览切换差异
 * @param {string} service - 服务标识
 * @param {string} variant
 * @returns {object}
 */
export function previewSwitch(service, variant) {
  return switchConfig(service, variant, { dryRun: true });
}

/**
 * 列出可用的服务
 * @returns {Array<string>}
 */
function listAvailableServices() {
  const { listServices } = require('./registry.js');
  return listServices().map(s => s.id);
}

/**
 * 列出指定服务的可用配置变体
 * @param {ServiceAdapter} adapter
 * @returns {Array<string>}
 */
function listAvailableVariants(adapter) {
  return adapter.scanVariants().map(v => v.name);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/integration/switch-flow.test.js`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/core/switcher.js tests/integration/switch-flow.test.js
git commit -m "refactor: use atomic and isolation modules in switcher"
```

---

## Phase 2: 功能增强（中优先级）

### Task 2.1: Create init command

**Files:**
- Create: `src/commands/init.js`
- Test: `tests/e2e/init-workflow.test.js`

**Step 1: Write the failing test**

Create `tests/e2e/init-workflow.test.js`:

```javascript
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initCommand } from '../../src/commands/init.js';

describe('init command e2e', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-init-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create config directory when it does not exist', async () => {
    process.env.CLAUDE_CONFIG_DIR = testDir;

    // Mock inquirer to auto-confirm
    const result = await initCommand('claude');

    expect(fs.existsSync(testDir)).toBe(true);
  });

  it('should create example config file', async () => {
    process.env.CLAUDE_CONFIG_DIR = testDir;

    await initCommand('claude');

    const configPath = path.join(testDir, 'settings.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(content.api_key).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/e2e/init-workflow.test.js`
Expected: FAIL with "Cannot find package '../../src/commands/init.js'"

**Step 3: Write minimal implementation**

Create `src/commands/init.js`:

```javascript
import inquirer from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { getAdapter } from '../core/registry.js';

/**
 * 初始化指定服务的配置
 * @param {string} service - 服务标识
 */
export async function initCommand(service = 'claude') {
  console.log(chalk.cyan(`\n🚀 Initializing ${service} configuration...\n`));

  const adapter = getAdapter(service);
  if (!adapter) {
    console.log(chalk.red(`Unknown service: ${service}`));
    return { success: false, error: `Unknown service: ${service}` };
  }

  const configDir = adapter.getConfigDir();

  // 1. 检查并创建配置目录
  if (!fs.existsSync(configDir)) {
    const { shouldCreate } = await inquirer.prompt({
      type: 'confirm',
      name: 'shouldCreate',
      message: `Create config directory at ${configDir}?`,
      default: true
    });

    if (shouldCreate) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(chalk.green('✓ Directory created'));
    } else {
      console.log(chalk.gray('Init cancelled'));
      return { success: false, cancelled: true };
    }
  }

  // 2. 检查现有配置
  const targetPath = adapter.getTargetPath();
  if (fs.existsSync(targetPath)) {
    console.log(chalk.yellow(`\n⚠ Existing config found at ${targetPath}`));

    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Create a new variant from existing config', value: 'variant' },
        { name: 'Overwrite existing config (not recommended)', value: 'overwrite' },
        { name: 'Cancel', value: 'cancel' }
      ]
    });

    if (action === 'cancel') {
      return { success: false, cancelled: true };
    }
    if (action === 'variant') {
      return await createVariant(adapter, targetPath);
    }
  }

  // 3. 创建示例配置
  return await createExampleConfig(adapter, targetPath);
}

/**
 * 从现有配置创建变体
 */
async function createVariant(adapter, targetPath) {
  const { variantName } = await inquirer.prompt({
    type: 'input',
    name: 'variantName',
    message: 'Enter variant name (e.g., openai, local):',
    validate: input => input.trim().length > 0 || 'Name cannot be empty'
  });

  const variantPath = adapter.getVariantPath(variantName);
  fs.copyFileSync(targetPath, variantPath);

  console.log(chalk.green(`✓ Created variant: ${variantPath}`));
  return { success: true, variant: variantName };
}

/**
 * 创建示例配置
 */
async function createExampleConfig(adapter, targetPath) {
  const examples = getServiceExamples();
  const service = adapter.id;
  const example = examples[service];

  if (!example) {
    console.log(chalk.yellow(`No example available for ${service}`));
    return { success: false, error: 'No example available' };
  }

  console.log(chalk.cyan('\n📝 Creating example configuration:\n'));
  console.log(chalk.gray(example.comment));

  const { confirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Create this example config?',
    default: true
  });

  if (confirm) {
    fs.writeFileSync(targetPath, example.content);
    console.log(chalk.green(`✓ Created: ${targetPath}`));
    console.log(chalk.yellow('\n⚠ Please edit the config with your actual credentials'));
    return { success: true };
  }

  return { success: false, cancelled: true };
}

/**
 * 获取服务示例配置
 */
function getServiceExamples() {
  return {
    claude: {
      comment: '# Example Claude settings.json',
      content: JSON.stringify({
        api_key: 'sk-ant-your-key-here',
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200000
      }, null, 2)
    },
    gemini: {
      comment: '# Example Gemini .env',
      content: 'GEMINI_API_KEY=your-key-here\n'
    },
    codex: {
      comment: '# Example Codex config.toml',
      content: 'env_key = "sk-your-key-here"\n'
    }
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/e2e/init-workflow.test.js`
Expected: PASS (2 tests, may need mocking for inquirer)

**Step 5: Commit**

```bash
git add src/commands/init.js tests/e2e/init-workflow.test.js
git commit -m "feat: add init command"
```

---

### Task 2.2: Create error formatter module

**Files:**
- Create: `src/utils/error-formatter.js`
- Test: `tests/unit/error-formatter.test.js`

**Step 1: Write the failing test**

Create `tests/unit/error-formatter.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  formatVariantNotFoundError,
  formatValidationError
} from '../../src/utils/error-formatter.js';

describe('error formatter', () => {
  it('should format variant not found error', () => {
    const adapter = {
      getConfigDir: () => '/test/.claude',
      getVariantPath: (v) => `/test/.claude/settings.json.${v}`,
      scanVariants: () => [{ name: 'default' }, { name: 'local' }]
    };

    const result = formatVariantNotFoundError('claude', 'openai', adapter);

    expect(result.title).toBeTruthy();
    expect(result.details).toBeDefined();
    expect(result.suggestions).toBeDefined();
  });

  it('should format validation error', () => {
    const result = formatValidationError('/test/settings.json', {
      message: 'Unexpected token'
    });

    expect(result.title).toBeTruthy();
    expect(result.details).toBeDefined();
    expect(result.suggestions).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/error-formatter.test.js`
Expected: FAIL with "Cannot find package '../../src/utils/error-formatter.js'"

**Step 3: Write minimal implementation**

Create `src/utils/error-formatter.js`:

```javascript
import chalk from 'chalk';

/**
 * 格式化配置未找到错误
 * @param {string} service - 服务标识
 * @param {string} variant - 变体名称
 * @param {object} adapter - 服务适配器
 * @returns {{title: string, details: Array<string>, suggestions: Array<string>}}
 */
export function formatVariantNotFoundError(service, variant, adapter) {
  const targetDir = adapter.getConfigDir();
  const expectedPath = adapter.getVariantPath(variant);
  const availableVariants = adapter.scanVariants();

  return {
    title: chalk.red('Configuration variant not found'),
    details: [
      chalk.gray(`Service: ${service}`),
      chalk.gray(`Variant: ${variant}`),
      chalk.gray(`Expected path: ${expectedPath}`),
      '',
      chalk.yellow('Available variants:'),
      ...availableVariants.map(v => chalk.gray(`  - ${v.name}`))
    ],
    suggestions: [
      `Check the file exists at: ${expectedPath}`,
      `Ensure the directory exists: ${targetDir}`,
      `Available variants: ${availableVariants.map(v => v.name).join(', ')}`
    ]
  };
}

/**
 * 格式化验证错误（带上下文）
 * @param {string} filePath - 文件路径
 * @param {Error} error - 错误对象
 * @returns {{title: string, details: Array<string>, suggestions: Array<string>}}
 */
export function formatValidationError(filePath, error) {
  return {
    title: chalk.red('Configuration validation failed'),
    details: [
      chalk.gray(`File: ${filePath}`),
      '',
      chalk.yellow('Error:'),
      chalk.gray(`  ${error.message}`)
    ],
    suggestions: [
      'Check the file syntax',
      'Ensure all required fields are present',
      `Run: cs-cli validate ${filePath}`
    ]
  };
}

/**
 * 输出格式化的错误信息
 * @param {object} formattedError - 格式化后的错误对象
 */
export function printError(formattedError) {
  console.log(`\n${formattedError.title}`);
  if (formattedError.details) {
    console.log(formattedError.details.join('\n'));
  }
  if (formattedError.suggestions) {
    console.log(chalk.yellow('\nSuggestions:'));
    console.log(formattedError.suggestions.map(s => `  ${s}`).join('\n'));
  }
  console.log();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/error-formatter.test.js`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/utils/error-formatter.js tests/unit/error-formatter.test.js
git commit -m "feat: add error formatter module"
```

---

### Task 2.3: Create history and undo module

**Files:**
- Create: `src/core/history.js`
- Create: `src/commands/undo.js`
- Test: `tests/unit/history.test.js`

**Step 1: Write the failing test**

Create `tests/unit/history.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { undoSwitch, getHistory } from '../../src/core/history.js';
import { createBackup } from '../../src/core/backup.js';

describe('history and undo', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-history-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = testDir;

    // 创建配置
    fs.mkdirSync(path.join(testDir, '.cs-backups'), { recursive: true });
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return error when no backups exist', () => {
    const result = undoSwitch('claude');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No previous backup');
  });

  it('should return error when only one backup exists', () => {
    createBackup('claude');

    const result = undoSwitch('claude');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No previous backup');
  });

  it('should get history from backups', () => {
    createBackup('claude');

    const history = getHistory('claude', 10);

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/history.test.js`
Expected: FAIL with "Cannot find package '../../src/core/history.js'"

**Step 3: Write minimal implementation**

Create `src/core/history.js`:

```javascript
import { listBackups, restoreBackup } from './backup.js';
import fs from 'node:fs';

/**
 * 撤销最后一次切换
 * 通过恢复上一个备份来实现
 * @param {string} service - 服务标识
 * @returns {{success: boolean, error?: string, restoredFrom?: string}}
 */
export function undoSwitch(service = 'claude') {
  const backups = listBackups(service);

  if (backups.length < 2) {
    return {
      success: false,
      error: 'No previous backup found. Cannot undo.'
    };
  }

  // 倒数第二个备份是切换前的状态
  const previousBackup = backups[1];

  return restoreBackup(service, previousBackup.timestamp);
}

/**
 * 获取切换历史
 * 基于备份时间戳推断
 * @param {string} service - 服务标识
 * @param {number} limit - 返回条数限制
 * @returns {Array<{timestamp: string, variant: string, isCurrent: boolean}>}
 */
export function getHistory(service = 'claude', limit = 10) {
  const backups = listBackups(service);
  const statePath = getStatePath(service);

  let currentVariant = 'unknown';
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      currentVariant = state.current || 'unknown';
    } catch {
      // 状态文件损坏，使用默认值
    }
  }

  return backups.slice(0, limit).map((backup, index) => ({
    timestamp: backup.timestamp,
    variant: index === 0 ? currentVariant : `backup-${backup.timestamp.slice(-6)}`,
    isCurrent: index === 0
  }));
}

/**
 * 获取状态文件路径
 * @param {string} service - 服务标识
 * @returns {string}
 */
function getStatePath(service) {
  const { getAdapter } = require('./registry.js');
  const adapter = getAdapter(service);
  if (!adapter) {
    return '';
  }
  return path.join(adapter.getConfigDir(), '.cs-state.json');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/history.test.js`
Expected: PASS (4 tests)

**Step 5: Create undo command**

Create `src/commands/undo.js`:

```javascript
import { undoSwitch } from '../core/history.js';
import { logAudit } from '../utils/logger.js';
import chalk from 'chalk';

/**
 * 撤销最后一次切换
 * @param {object} options - { service: string }
 */
export function undoCommand(options = {}) {
  const { service = 'claude' } = options;

  const result = undoSwitch(service);

  logAudit({
    action: 'undo',
    service,
    success: result.success
  });

  if (result.success) {
    console.log(chalk.green(`✓ Undid last ${service} switch`));
    if (result.restoredFrom) {
      console.log(chalk.gray(`Restored from: ${result.restoredFrom}`));
    }
  } else {
    console.log(chalk.red(`✗ Failed: ${result.error}`));
  }

  return result;
}
```

**Step 6: Commit**

```bash
git add src/core/history.js src/commands/undo.js tests/unit/history.test.js
git commit -m "feat: add history and undo functionality"
```

---

### Task 2.4: Update restore command for interactive selection

**Files:**
- Modify: `src/commands/restore.js`

**Step 1: Modify restore.js to support interactive selection**

Replace `src/commands/restore.js` content with:

```javascript
import inquirer from '@inquirer/prompts';
import chalk from 'chalk';
import { listBackups, restoreBackup } from '../core/backup.js';

/**
 * 恢复配置备份
 * @param {string} service - 服务标识
 * @param {string} timestamp - 备份时间戳（可选，交互式选择）
 */
export async function restoreCommand(service, timestamp) {
  // 如果提供了时间戳，直接恢复
  if (timestamp) {
    return restoreBackup(service, timestamp);
  }

  // 交互式选择
  const backups = listBackups(service);

  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found'));
    return { success: false, error: 'No backups found' };
  }

  const { selected } = await inquirer.prompt({
    type: 'list',
    name: 'selected',
    message: `Select a ${service} backup to restore:`,
    choices: backups.map(b => ({
      name: formatBackupChoice(b),
      value: b.timestamp
    }))
  });

  const result = restoreBackup(service, selected);

  if (result.success) {
    console.log(chalk.green(`✓ Restored from ${selected}`));
  } else {
    console.log(chalk.red(`✗ ${result.error}`));
  }

  return result;
}

/**
 * 格式化备份选项显示
 * @param {{timestamp: string, name: string, path: string}} backup
 * @returns {string}
 */
function formatBackupChoice(backup) {
  const ts = backup.timestamp;
  const date = new Date(
    ts.slice(0, 4),
    parseInt(ts.slice(4, 6)) - 1,
    ts.slice(6, 8),
    ts.slice(8, 10),
    ts.slice(10, 12),
    ts.slice(12, 14)
  );

  const relative = getRelativeTime(date);
  return `${backup.timestamp} (${relative})`;
}

/**
 * 获取相对时间描述
 * @param {Date} date
 * @returns {string}
 */
function getRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
```

**Step 2: Run existing tests to verify**

Run: `npm test tests/backup.test.js`
Expected: PASS (if exists, otherwise skip)

**Step 3: Commit**

```bash
git add src/commands/restore.js
git commit -m "feat: add interactive restore selection"
```

---

## Phase 3: 体验优化（低优先级）

### Task 3.1: Create audit logger module

**Files:**
- Create: `src/utils/logger.js`
- Create: `src/commands/audit.js`
- Test: `tests/unit/logger.test.js`

**Step 1: Write the failing test**

Create `tests/unit/logger.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  logAudit,
  readAuditLog,
  logSwitch,
  logBackup,
  logRestore
} from '../../src/utils/logger.js';

describe('audit logger', () => {
  let testDir;
  let originalHome;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-audit-'));
    originalHome = process.env.HOME;
    // Mock HOME directory
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should log audit events', () => {
    logAudit({ action: 'test', data: 'value' });

    const logs = readAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0].event.action).toBe('test');
  });

  it('should log switch events', () => {
    logSwitch('claude', 'openai', true);

    const logs = readAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0].event.action).toBe('switch');
    expect(logs[0].event.service).toBe('claude');
  });

  it('should filter logs by service', () => {
    logSwitch('claude', 'openai', true);
    logSwitch('gemini', 'prod', true);

    const claudeLogs = readAuditLog({ service: 'claude' });
    expect(claudeLogs.length).toBe(1);
    expect(claudeLogs[0].event.service).toBe('claude');
  });

  it('should limit log entries', () => {
    for (let i = 0; i < 20; i++) {
      logAudit({ action: `test-${i}` });
    }

    const logs = readAuditLog({ limit: 5 });
    expect(logs.length).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/logger.test.js`
Expected: FAIL with "Cannot find package '../../src/utils/logger.js'"

**Step 3: Write minimal implementation**

Create `src/utils/logger.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const AUDIT_LOG_PATH = path.join(os.homedir(), '.cs-cli', 'audit.log');

/**
 * 记录审计日志
 * @param {object} event - 事件对象
 */
export function logAudit(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    pid: process.pid,
    event
  };

  ensureAuditDir();
  const line = JSON.stringify(entry) + '\n';

  try {
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch (error) {
    // 静默失败，不影响主流程
  }
}

/**
 * 读取审计日志
 * @param {object} options - { service: string, action: string, limit: number }
 * @returns {Array<object>}
 */
export function readAuditLog(options = {}) {
  if (!fs.existsSync(AUDIT_LOG_PATH)) {
    return [];
  }

  const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
  const entries = content.split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let filtered = entries;

  if (options.service) {
    filtered = filtered.filter(e => e.event.service === options.service);
  }

  if (options.action) {
    filtered = filtered.filter(e => e.event.action === options.action);
  }

  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

/**
 * 格式化审计日志输出
 * @param {Array} entries - 日志条目
 * @returns {string}
 */
export function formatAuditLog(entries) {
  return entries.map(entry => {
    const date = new Date(entry.timestamp).toLocaleString();
    const event = entry.event;
    return `[${date}] ${event.action} ${event.service || ''} ${event.variant || ''}`;
  }).join('\n');
}

/**
 * 确保审计日志目录存在
 */
function ensureAuditDir() {
  const dir = path.dirname(AUDIT_LOG_PATH);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // 忽略错误
    }
  }
}

/**
 * 记录切换操作
 */
export function logSwitch(service, variant, success) {
  logAudit({
    action: 'switch',
    service,
    variant,
    success,
    cwd: process.cwd()
  });
}

/**
 * 记录备份操作
 */
export function logBackup(service, timestamp) {
  logAudit({
    action: 'backup',
    service,
    timestamp
  });
}

/**
 * 记录恢复操作
 */
export function logRestore(service, fromTimestamp) {
  logAudit({
    action: 'restore',
    service,
    from: fromTimestamp
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/logger.test.js`
Expected: PASS (5 tests)

**Step 5: Create audit command**

Create `src/commands/audit.js`:

```javascript
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
```

**Step 6: Commit**

```bash
git add src/utils/logger.js src/commands/audit.js tests/unit/logger.test.js
git commit -m "feat: add audit logging"
```

---

### Task 3.2: Create shell completion module

**Files:**
- Create: `src/core/completion.js`
- Create: `src/commands/completion.js`
- Test: `tests/unit/completion.test.js`

**Step 1: Write the failing test**

Create `tests/unit/completion.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  generateCompletionScript,
  getCompletions
} from '../../src/core/completion.js';

describe('shell completion', () => {
  it('should generate bash completion script', () => {
    const script = generateCompletionScript('bash');

    expect(script).toContain('complete');
    expect(script).toContain('_cs_cli_completion');
  });

  it('should generate zsh completion script', () => {
    const script = generateCompletionScript('zsh');

    expect(script).toContain('#compdef');
    expect(script).toContain('cs-cli');
  });

  it('should complete main commands', () => {
    const completions = getCompletions('', ['cs-cli']);

    expect(completions).toContain('list');
    expect(completions).toContain('switch');
    expect(completions).toContain('init');
    expect(completions).toContain('undo');
  });

  it('should complete service names after --service', () => {
    const completions = getCompletions('', ['cs-cli', 'switch', '--service']);

    expect(completions).toContain('claude');
    expect(completions).toContain('gemini');
    expect(completions).toContain('codex');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/completion.test.js`
Expected: FAIL with "Cannot find package '../../src/core/completion.js'"

**Step 3: Write minimal implementation**

Create `src/core/completion.js`:

```javascript
import { listServices } from './registry.js';

/**
 * 生成 Shell 补全脚本
 * @param {string} shell - Shell 类型 (bash/zsh/powershell/fish)
 * @returns {string}
 */
export function generateCompletionScript(shell) {
  const scripts = {
    bash: bashScript(),
    zsh: zshScript(),
    powershell: powershellScript(),
    fish: fishScript()
  };

  return scripts[shell] || scripts.bash;
}

/**
 * 补全查询函数（被补全脚本调用）
 * @param {string} current - 当前输入的词
 * @param {string} words - 所有输入的词（空格分隔）
 * @returns {Array<string>}
 */
export function getCompletions(current, words) {
  const wordList = words.split(' ').filter(Boolean);
  const cmd = wordList[wordList.length - 2] || '';

  // 补全主命令
  if (wordList.length <= 2) {
    return ['list', 'switch', 'current', 'diff', 'backup', 'restore', 'init', 'undo', 'completion', 'audit', '--help', '-h'];
  }

  // 补全 --service/-s 参数的值
  if (cmd === '--service' || cmd === '-s') {
    return listServices().map(s => s.id);
  }

  // 补全 switch 命令的变体名
  if (wordList[1] === 'switch' || wordList[1] === 'sw') {
    const serviceIndex = wordList.indexOf('--service') + 1 || wordList.indexOf('-s') + 1;
    const service = serviceIndex > 0 && serviceIndex < wordList.length ? wordList[serviceIndex] : 'claude';

    const adapter = getAdapter(service);
    if (adapter) {
      try {
        return adapter.scanVariants().map(v => v.name);
      } catch {
        return [];
      }
    }
  }

  // 补全 diff 命令的变体名
  if (wordList[1] === 'diff') {
    const serviceIndex = wordList.indexOf('--service') + 1 || wordList.indexOf('-s') + 1;
    const service = serviceIndex > 0 && serviceIndex < wordList.length ? wordList[serviceIndex] : 'claude';

    const adapter = getAdapter(service);
    if (adapter) {
      try {
        return adapter.scanVariants().map(v => v.name);
      } catch {
        return [];
      }
    }
  }

  return [];
}

function getAdapter(service) {
  try {
    const { getAdapter } = require('./registry.js');
    return getAdapter(service);
  } catch {
    return null;
  }
}

function bashScript() {
  return `#!/bin/bash
_cs_cli_completion() {
  local cur words
  cur="\${COMP_WORDS[COMP_CWORD]}"
  words=("\${COMP_WORDS[@]}")

  COMPREPLY=($(compgen -W "$(cs-cli completion --query "\$cur" "\${words[*]}")" -- "\$cur"))
}

complete -F _cs_cli_completion cs-cli
`;
}

function zshScript() {
  return `#compdef cs-cli
_cs_cli() {
  local -a completions
  completions=("\$(cs-cli completion --query "\${words[CURRENT-1]}" "\${words[*]}")")
  _describe 'values' completions
}
`;
}

function powershellScript() {
  return `Register-ArgumentCompleter -Native -CommandName cs-cli -ScriptBlock {
  param(\$wordToComplete, \$commandAst, \$cursorPosition)
  \$completions = & cs-cli completion --query \$wordToComplete \$commandAst.ToString()
  \$completions | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new(\$_, \$_, 'ParameterValue', \$_)
  }
}
`;
}

function fishScript() {
  return `complete -c cs-cli -f
complete -c cs-cli -n '__fish_use_subcommand' -a list switch current diff backup restore init undo completion audit
complete -c cs-cli -n '__fish_seen_subcommand_from switch' -a '(cs-cli completion --query (commandline -cp))'
`;
}
```

**Step 4: Create completion command**

Create `src/commands/completion.js`:

```javascript
import { generateCompletionScript } from '../core/completion.js';
import { getCompletions } from '../core/completion.js';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 生成或安装 Shell 补全脚本
 * @param {string} shell - Shell 类型
 * @param {object} options - { install: boolean, output: string }
 */
export function completionCommand(shell, options = {}) {
  // 处理内部查询（由补全脚本调用）
  if (shell === '--query') {
    const words = options.words || '';
    const current = options.current || '';
    const completions = getCompletions(current, words);
    console.log(completions.join(' '));
    return { success: true };
  }

  // 确定默认 shell
  if (!shell) {
    shell = detectShell();
  }

  // 生成或安装补全脚本
  if (options.install) {
    return installCompletion(shell, options.output);
  }

  const script = generateCompletionScript(shell);
  console.log(script);
  console.log(chalk.gray(`\n# Add to your shell config, or run: cs-cli completion ${shell} --install`));

  return { success: true };
}

/**
 * 检测当前 Shell
 */
function detectShell() {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (process.platform === 'win32') return 'powershell';
  return 'bash';
}

/**
 * 安装补全脚本
 */
function installCompletion(shell, outputPath) {
  const script = generateCompletionScript(shell);

  // 默认输出路径
  let targetPath = outputPath;
  if (!targetPath) {
    const homeDir = require('os').homedir();
    const paths = {
      bash: path.join(homeDir, '.cs-cli', 'completion.bash'),
      zsh: path.join(homeDir, '.cs-cli', 'completion.zsh'),
      powershell: path.join(homeDir, '.cs-cli', 'completion.ps1'),
      fish: path.join(homeDir, '.config', 'fish', 'completions', 'cs-cli.fish')
    };
    targetPath = paths[shell] || paths.bash;
  }

  // 确保目录存在
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 写入脚本
  fs.writeFileSync(targetPath, script);

  const instructions = {
    bash: `Add to ~/.bashrc: source ${targetPath}`,
    zsh: `Add to ~/.zshrc: source ${targetPath}`,
    powershell: `Add to \$PROFILE: . ${targetPath}`,
    fish: `File already in correct location`
  };

  console.log(chalk.green(`✓ Completion script installed to: ${targetPath}`));
  console.log(chalk.yellow(instructions[shell]));

  return { success: true, path: targetPath, instructions: instructions[shell] };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test tests/unit/completion.test.js`
Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add src/core/completion.js src/commands/completion.js tests/unit/completion.test.js
git commit -m "feat: add shell completion"
```

---

### Task 3.3: Update CLI entry point with new commands

**Files:**
- Modify: `bin/cs-cli.js`

**Step 1: Update bin/cs-cli.js**

Replace `bin/cs-cli.js` content with:

```javascript
#!/usr/bin/env node
import { Command } from 'commander';
import { listCommand } from '../src/commands/list.js';
import { switchCommand } from '../src/commands/switch.js';
import { currentCommand } from '../src/commands/current.js';
import { diffCommand } from '../src/commands/diff.js';
import { backupCommand } from '../src/commands/backup.js';
import { restoreCommand } from '../src/commands/restore.js';
import { initCommand } from '../src/commands/init.js';
import { undoCommand } from '../src/commands/undo.js';
import { completionCommand } from '../src/commands/completion.js';
import { auditLogCommand } from '../src/commands/audit.js';
import { defaultCommand } from '../src/commands/default.js';

const program = new Command();

program
  .name('cs-cli')
  .description('多编码工具 CLI 配置切换工具')
  .version('0.2.0');

// 主命令
program
  .command('list')
  .alias('ls')
  .description('列出所有可用的配置')
  .option('-s, --service <service>', '编码工具 (claude/gemini/codex)')
  .option('-a, --all', '显示所有编码工具的详细配置')
  .action(listCommand);

program
  .command('switch')
  .alias('sw')
  .description('切换配置')
  .argument('[variant]', '配置变体名称')
  .option('-s, --service <service>', '编码工具', 'claude')
  .option('-n, --no-backup', '不创建备份')
  .option('-d, --dry-run', '预览切换，不实际执行')
  .option('-p, --preview', '显示变更预览')
  .action(switchCommand);

program
  .command('current')
  .description('查看当前生效的配置')
  .option('-s, --service <service>', '编码工具')
  .option('-a, --all', '显示所有编码工具的详细配置')
  .action(currentCommand);

program
  .command('diff')
  .description('比较配置差异')
  .argument('[variant1]', '第一个配置变体')
  .argument('[variant2]', '第二个配置变体（可选，默认为当前配置）')
  .option('-s, --service <service>', '编码工具', 'claude')
  .action(diffCommand);

program
  .command('backup')
  .description('创建配置备份')
  .option('-s, --service <service>', '编码工具', 'claude')
  .option('-l, --list', '列出所有备份')
  .action(backupCommand);

program
  .command('restore')
  .description('恢复配置备份')
  .argument('[timestamp]', '备份时间戳（可选，交互式选择）')
  .option('-s, --service <service>', '编码工具', 'claude')
  .action(restoreCommand);

// 新增命令
program
  .command('init')
  .description('初始化配置')
  .argument('[service]', '编码工具', 'claude')
  .action(initCommand);

program
  .command('undo')
  .description('撤销最后一次切换')
  .option('-s, --service <service>', '编码工具', 'claude')
  .action(undoCommand);

program
  .command('completion')
  .description('生成 Shell 自动补全脚本')
  .argument('[shell]', 'Shell 类型 (bash/zsh/powershell/fish)')
  .option('-i, --install', '安装到系统')
  .option('-o, --output <path>', '输出文件路径')
  .action(completionCommand);

program
  .command('audit')
  .description('查看审计日志')
  .option('-s, --service <service>', '过滤服务')
  .option('-a, --action <action>', '过滤操作类型')
  .option('-n, --limit <number>', '显示条数', '10')
  .action(auditLogCommand);

// 默认交互模式
program.action(defaultCommand);

program.parse();
```

**Step 2: Commit**

```bash
git add bin/cs-cli.js
git commit -m "feat: update CLI with new commands (init, undo, completion, audit)"
```

---

### Task 3.4: Update switch command to integrate logging

**Files:**
- Modify: `src/commands/switch.js`

**Step 1: Update switch.js to add logging**

Add to `src/commands/switch.js`:

```javascript
import { logSwitch } from '../utils/logger.js';

// 在 switchCommand 函数中，调用 switchConfig 后添加：
logSwitch(service, variant, result.success);
```

**Step 2: Update backup command to add logging**

Add to `src/commands/backup.js`:

```javascript
import { logBackup } from '../utils/logger.js';

// 在创建备份后添加：
if (result.success) {
  logBackup(service, result.timestamp);
}
```

**Step 3: Commit**

```bash
git add src/commands/switch.js src/commands/backup.js
git commit -m "feat: integrate audit logging in commands"
```

---

### Task 3.5: Update README with new features

**Files:**
- Modify: `README.md`

**Step 1: Update README.md**

Add sections for new commands:

```markdown
## 新增命令

### init - 初始化配置

\`\`\`bash
cs-cli init claude
\`\`\`

交互式初始化向导，帮助创建配置目录和示例文件。

### undo - 撤销切换

\`\`\`bash
cs-cli undo
cs-cli undo -s gemini
\`\`\`

撤销最后一次切换操作，恢复到上一个配置。

### completion - Shell 补全

\`\`\`bash
# 生成补全脚本
cs-cli completion bash

# 安装补全脚本
cs-cli completion bash --install
\`\`\`

### audit - 审计日志

\`\`\`bash
# 查看最近 10 条操作
cs-cli audit

# 过滤特定服务
cs-cli audit -s claude

# 查看更多条目
cs-cli audit -n 50
\`\`\`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with new commands"
```

---

## Phase 4: 最终测试和清理

### Task 4.1: Run all tests

**Step 1: Run full test suite**

Run: `npm test`

Expected: All new tests pass (30+ tests total)

**Step 2: Fix any failing tests**

If any tests fail, fix issues and commit.

**Step 3: Commit final test updates**

```bash
git add tests/
git commit -m "test: fix failing tests and finalize test suite"
```

---

### Task 4.2: Integration test for concurrent operations

**Files:**
- Create: `tests/integration/concurrent.test.js`

**Step 1: Create concurrent test**

Create `tests/integration/concurrent.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { switchConfig } from '../../src/core/switcher.js';

describe('concurrent operations', () => {
  let testDir;
  let originalEnv;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cli-concurrent-'));
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = testDir;

    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'settings.json'),
      JSON.stringify({ api_key: 'sk-default' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.openai'),
      JSON.stringify({ api_key: 'sk-openai' })
    );
    fs.writeFileSync(
      path.join(testDir, 'settings.json.local'),
      JSON.stringify({ api_key: 'sk-local' })
    );
  });

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = originalEnv;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle concurrent switches safely', async () => {
    const switches = [
      switchConfig('claude', 'openai'),
      switchConfig('claude', 'local'),
      switchConfig('claude', 'openai')
    ];

    const results = await Promise.allSettled(switches);

    // 所有操作都应该成功（进程隔离）
    results.forEach(result => {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expect(result.value.success).toBe(true);
      }
    });
  });
});
```

**Step 2: Run test**

Run: `npm test tests/integration/concurrent.test.js`

**Step 3: Commit**

```bash
git add tests/integration/concurrent.test.js
git commit -m "test: add concurrent operations test"
```

---

### Task 4.3: Final cleanup and verification

**Step 1: Update package.json version**

Update version to 0.2.0:

```json
{
  "version": "0.2.0"
}
```

**Step 2: Run linter**

Run: `npm run lint`

Fix any linting issues.

**Step 3: Final commit**

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0"
```

---

## 实施完成检查清单

- [ ] 所有单元测试通过 (30+ tests)
- [ ] 所有集成测试通过
- [ ] 代码风格检查通过
- [ ] README 更新完成
- [ ] 版本号更新为 0.2.0
- [ ] 所有新命令可正常运行

---

## 总结

本计划涵盖 12 个改进项的实施，分为 3 个阶段：

1. **基础设施** - 原子操作、进程隔离、语义验证
2. **功能增强** - init 命令、错误格式化、交互恢复、撤销功能
3. **体验优化** - Shell 补全、审计日志

预计工作量：约 40 小时
