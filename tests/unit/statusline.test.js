import { describe, it, expect } from 'vitest';
import {
  getVendorColor,
  formatVendor,
  injectStatusLine,
  VENDOR_COLORS,
  getProgressColor,
  PROGRESS_COLORS,
  renderProgressBar,
  RESET,
  DIM,
  calculateContextPercent,
  calculateContextUsage,
  renderStatusBar,
  getDirName,
  parseModelName,
  renderStatus,
  CYAN,
  GREEN_BRIGHT,
  renderRow1,
  renderRow2,
  renderModelLine,
  renderContextLine,
  renderBranchLine,
} from '../../src/core/statusline.js';

describe('statusline', () => {
  describe('getVendorColor', () => {
    it('should return correct color for known vendors', () => {
      expect(getVendorColor('glm')).toBe(VENDOR_COLORS.glm);
      expect(getVendorColor('kimi')).toBe(VENDOR_COLORS.kimi);
      expect(getVendorColor('minimax')).toBe(VENDOR_COLORS.minimax);
    });

    it('should return default color for unknown vendors', () => {
      expect(getVendorColor('unknown-vendor')).toBe(VENDOR_COLORS.default);
    });
  });

  describe('formatVendor', () => {
    it('should uppercase vendor name', () => {
      expect(formatVendor('glm')).toBe('GLM');
      expect(formatVendor('Kimi')).toBe('KIMI');
    });

    it('should handle empty string', () => {
      expect(formatVendor('')).toBe('UNKNOWN');
    });

    it('should handle undefined', () => {
      expect(formatVendor(undefined)).toBe('UNKNOWN');
    });
  });

  describe('getProgressColor', () => {
    it('should return safe color for percent < 50', () => {
      expect(getProgressColor(0)).toBe(PROGRESS_COLORS.safe);
      expect(getProgressColor(25)).toBe(PROGRESS_COLORS.safe);
      expect(getProgressColor(49)).toBe(PROGRESS_COLORS.safe);
    });

    it('should return warning color for percent 50-79', () => {
      expect(getProgressColor(50)).toBe(PROGRESS_COLORS.warning);
      expect(getProgressColor(65)).toBe(PROGRESS_COLORS.warning);
      expect(getProgressColor(79)).toBe(PROGRESS_COLORS.warning);
    });

    it('should return danger color for percent >= 80', () => {
      expect(getProgressColor(80)).toBe(PROGRESS_COLORS.danger);
      expect(getProgressColor(90)).toBe(PROGRESS_COLORS.danger);
      expect(getProgressColor(100)).toBe(PROGRESS_COLORS.danger);
    });
  });

  describe('renderProgressBar', () => {
    it('should render 0% progress bar with all empty circles', () => {
      const bar = renderProgressBar(0);
      expect(bar).toContain('○'.repeat(11));
      expect(bar).not.toContain('●');
      expect(bar).toContain('0%');
    });

    it('should render ~50% progress bar', () => {
      const bar = renderProgressBar(50);
      // Math.round(50/100 * 11) = 6 filled, 5 empty
      expect(bar).toContain('●'.repeat(6));
      expect(bar).toContain('○'.repeat(5));
      expect(bar).toContain('50%');
    });

    it('should render 100% progress bar with all filled circles', () => {
      const bar = renderProgressBar(100);
      expect(bar).toContain('●'.repeat(11));
      expect(bar).not.toContain('○');
      expect(bar).toContain('100%');
    });

    it('should include RESET at the end', () => {
      const bar = renderProgressBar(50);
      expect(bar.endsWith(RESET)).toBe(true);
    });

    it('should include usage info when usedK and totalK provided', () => {
      const bar = renderProgressBar(69, 11, 32, 46);
      expect(bar).toContain('69%(32k/46k)');
      expect(bar.endsWith(RESET)).toBe(true);
    });

    it('should not include usage info when usedK/totalK are null', () => {
      const bar = renderProgressBar(50);
      expect(bar).not.toContain('(');
      expect(bar).not.toContain('k/');
    });
  });

  describe('calculateContextUsage', () => {
    it('should return percent, usedK and totalK', () => {
      const contextData = {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 50000,
          cache_creation_input_tokens: 30000,
          cache_read_input_tokens: 20000
        }
      };
      const result = calculateContextUsage(contextData);
      expect(result.percent).toBe(50);
      expect(result.usedK).toBe(100);
      expect(result.totalK).toBe(200);
    });

    it('should return zeros for null contextData', () => {
      const result = calculateContextUsage(null);
      expect(result.percent).toBe(0);
      expect(result.usedK).toBe(0);
      expect(result.totalK).toBe(0);
    });

    it('should handle missing current_usage', () => {
      const result = calculateContextUsage({ context_window_size: 100000 });
      expect(result.percent).toBe(0);
      expect(result.usedK).toBe(0);
      expect(result.totalK).toBe(100);
    });
  });

  describe('calculateContextPercent', () => {
    it('should calculate percent from current_usage', () => {
      const contextData = {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 50000,
          cache_creation_input_tokens: 30000,
          cache_read_input_tokens: 20000
        }
      };
      // (50000 + 30000 + 20000) / 200000 * 100 = 50%
      expect(calculateContextPercent(contextData)).toBe(50);
    });

    it('should return 0 when current_usage is null', () => {
      const contextData = {
        context_window_size: 200000,
        current_usage: null
      };
      expect(calculateContextPercent(contextData)).toBe(0);
    });

    it('should return 0 when contextData is null', () => {
      expect(calculateContextPercent(null)).toBe(0);
    });

    it('should return 0 when contextData is undefined', () => {
      expect(calculateContextPercent(undefined)).toBe(0);
    });

    it('should handle partial usage data', () => {
      const contextData = {
        context_window_size: 100000,
        current_usage: {
          input_tokens: 25000
        }
      };
      // 25000 / 100000 * 100 = 25%
      expect(calculateContextPercent(contextData)).toBe(25);
    });
  });

  describe('renderStatusBar', () => {
    const contextData = {
      context_window_size: 200000,
      current_usage: {
        input_tokens: 50000,
        cache_creation_input_tokens: 30000,
        cache_read_input_tokens: 20000,
      },
    };

    it('should render multi-line output with context on separate line', () => {
      const result = renderStatusBar('glm', contextData);
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines[0]).toContain('GLM');
      expect(lines[1]).toContain('50%');
    });

    it('should include vendor color', () => {
      const result = renderStatusBar('glm', contextData);
      expect(result).toContain(VENDOR_COLORS.glm);
    });

    it('should return single line when contextData is null and no cwd', () => {
      const result = renderStatusBar('kimi', null);
      expect(result).not.toContain('\n');
      expect(result).toContain('KIMI');
      expect(result).not.toContain('%');
    });

    it('should include directory on its own line when cwd provided', () => {
      const result = renderStatusBar('glm', contextData, '/home/user/my-project');
      const lines = result.split('\n');
      expect(lines.length).toBe(3);
      expect(lines[2]).toContain('my-project');
    });

    it('should include model name when provided', () => {
      const result = renderStatusBar('claude', contextData, null, 'claude-sonnet-4-5');
      expect(result).toContain('Sonnet 4.5');
    });

    it('should include status when provided', () => {
      const result = renderStatusBar('glm', contextData, null, null, 'thinking');
      expect(result).toContain('● thinking');
    });

    it('should have ⏵⏵ prefix on every line', () => {
      const result = renderStatusBar('glm', contextData, '/home/user/my-project', 'claude-opus-4-6', 'thinking');
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line).toContain('⏵⏵');
      }
    });
  });

  describe('getDirName', () => {
    it('should extract directory name from path', () => {
      expect(getDirName('/home/user/my-project')).toBe('my-project');
      expect(getDirName('C:\\Users\\test\\project')).toBe('project');
    });

    it('should return empty string for null', () => {
      expect(getDirName(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(getDirName(undefined)).toBe('');
    });

    it('should handle single directory', () => {
      expect(getDirName('project')).toBe('project');
    });
  });

  describe('parseModelName', () => {
    it('should parse claude opus model', () => {
      expect(parseModelName('claude-opus-4-6')).toBe('Opus 4.6');
    });

    it('should parse claude sonnet model', () => {
      expect(parseModelName('claude-sonnet-4-5')).toBe('Sonnet 4.5');
    });

    it('should parse claude model with date suffix', () => {
      expect(parseModelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
    });

    it('should parse gpt model', () => {
      expect(parseModelName('gpt-4o')).toBe('GPT-4o');
    });

    it('should parse gemini model', () => {
      expect(parseModelName('gemini-2.0-flash')).toBe('Gemini 2.0-flash');
    });

    it('should return empty string for null', () => {
      expect(parseModelName(null)).toBe('');
    });

    it('should return original string for unknown format', () => {
      expect(parseModelName('my-custom-model')).toBe('my-custom-model');
    });
  });

  describe('renderStatus', () => {
    it('should render thinking status with dim color', () => {
      const result = renderStatus('thinking');
      expect(result).toContain('● thinking');
      expect(result).toContain(DIM);
      expect(result).toContain(RESET);
    });

    it('should render active when status is null', () => {
      expect(renderStatus(null)).toContain('● active');
    });

    it('should render idle status', () => {
      expect(renderStatus('idle')).toContain('● idle');
    });
  });

  describe('renderModelLine', () => {
    it('should render vendor name in uppercase with vendor color', () => {
      const result = renderModelLine('glm', null, null);
      expect(result).toContain('GLM');
      expect(result).toContain(VENDOR_COLORS.glm);
    });

    it('should include model name when provided', () => {
      const result = renderModelLine('claude', 'claude-opus-4-6', null);
      expect(result).toContain('CLAUDE: Opus 4.6');
    });

    it('should include status with separator when provided', () => {
      const result = renderModelLine('glm', null, 'thinking');
      expect(result).toContain('● thinking');
      expect(result).toContain(' | ');
    });

    it('should omit status when null', () => {
      const result = renderModelLine('glm', null, null);
      expect(result).not.toContain('●');
      expect(result).not.toContain(' | ');
    });

    it('should start with ⏵⏵ prefix', () => {
      const result = renderModelLine('glm', null, null);
      expect(result).toContain('⏵⏵');
    });
  });

  describe('renderContextLine', () => {
    const contextData = {
      context_window_size: 200000,
      current_usage: { input_tokens: 50000, cache_creation_input_tokens: 30000, cache_read_input_tokens: 20000 },
    };

    it('should include context: prefix and progress bar', () => {
      const result = renderContextLine('glm', contextData);
      expect(result).toContain('context:');
      expect(result).toContain('50%');
      expect(result).toContain('●');
    });

    it('should start with ⏵⏵ prefix', () => {
      const result = renderContextLine('glm', contextData);
      expect(result).toContain('⏵⏵');
    });
  });

  describe('renderBranchLine', () => {
    it('should include directory name with color', () => {
      const result = renderBranchLine('glm', '/home/user/my-project');
      expect(result).toContain('my-project');
      expect(result).toContain(CYAN);
    });

    it('should start with ⏵⏵ prefix', () => {
      const result = renderBranchLine('glm', '/home/user/my-project');
      expect(result).toContain('⏵⏵');
    });

    it('should return null when cwd is null', () => {
      expect(renderBranchLine('glm', null)).toBeNull();
    });

    it('should include branch color when branch exists', () => {
      const result = renderBranchLine('glm', 'D:\\project\\java\\project\\code-cli-switch');
      expect(result).toContain('code-cli-switch');
      if (result.includes('(')) {
        expect(result).toContain(GREEN_BRIGHT);
      }
    });
  });

  describe('renderRow1 (legacy)', () => {
    it('should delegate to renderStatusBar', () => {
      const result = renderRow1('glm', null, null, null);
      expect(result).toContain('GLM');
    });
  });

  describe('renderRow2', () => {
    const contextData = {
      context_window_size: 200000,
      current_usage: {
        input_tokens: 50000,
        cache_creation_input_tokens: 30000,
        cache_read_input_tokens: 20000,
      },
    };

    it('should start with "context" label', () => {
      const result = renderRow2(contextData);
      expect(result.startsWith('context')).toBe(true);
    });

    it('should include percent value', () => {
      const result = renderRow2(contextData);
      expect(result).toContain('50%');
    });

    it('should include progress dots', () => {
      const result = renderRow2(contextData);
      expect(result).toContain('●');
      expect(result).toContain('○');
    });

    it('should show 0% when contextData is null', () => {
      const result = renderRow2(null);
      expect(result).toContain('0%');
    });

    it('should have exactly 3 spaces between label and progress bar', () => {
      const result = renderRow2(null);
      expect(result).toMatch(/^context   /);
    });
  });
});
