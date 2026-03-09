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
  renderStatusBar,
  getDirName,
  parseModelName,
  renderStatus,
  CYAN,
  GREEN_BRIGHT,
  renderRow1,
  renderRow2,
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
        cache_read_input_tokens: 20000
      }
    };

    it('should render status bar with vendor and context', () => {
      const result = renderStatusBar('glm', contextData);
      expect(result).toContain('厂商:GLM');
      expect(result).toContain('上下文:50%');
      expect(result).toContain('▓');
      expect(result).toContain('░');
    });

    it('should include vendor color', () => {
      const result = renderStatusBar('glm', contextData);
      expect(result).toContain(VENDOR_COLORS.glm);
    });

    it('should handle null contextData', () => {
      const result = renderStatusBar('kimi', null);
      expect(result).toContain('厂商:KIMI');
      expect(result).toContain('上下文:0%');
    });

    it('should include directory name when cwd provided', () => {
      const result = renderStatusBar('glm', contextData, '/home/user/my-project');
      expect(result).toContain('| 📁my-project');
    });

    it('should not include directory when cwd is null', () => {
      const result = renderStatusBar('glm', contextData, null);
      expect(result).not.toContain('📁');
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

  describe('renderRow1', () => {
    it('should render vendor name in uppercase with vendor color', () => {
      const result = renderRow1('glm', null, null, null);
      expect(result).toContain('GLM');
      expect(result).toContain(VENDOR_COLORS.glm);
    });

    it('should include model name when provided', () => {
      const result = renderRow1('claude', 'claude-opus-4-6', null, null);
      expect(result).toContain('CLAUDE: Opus 4.6');
    });

    it('should include directory name when cwd provided', () => {
      const result = renderRow1('glm', null, '/home/user/my-project', null);
      expect(result).toContain('my-project');
      expect(result).toContain(CYAN);
    });

    it('should include status when provided', () => {
      const result = renderRow1('glm', null, null, 'thinking');
      expect(result).toContain('● thinking');
      expect(result).toContain(DIM);
    });

    it('should omit status module when status is null', () => {
      const result = renderRow1('glm', null, null, null);
      expect(result).not.toContain('●');
    });

    it('should use separator between modules', () => {
      const result = renderRow1('glm', null, '/home/user/project', 'thinking');
      expect(result).toContain(' | ');
    });

    it('should not contain separator when only moduleA is present', () => {
      const result = renderRow1('glm', null, null, null);
      expect(result).not.toContain(' | ');
    });

    it('should include branch color when branch exists', () => {
      // 当 cwd 指向一个有 git 分支的目录时验证 GREEN_BRIGHT 颜色
      // 使用项目自身目录，它是一个 git repo
      const result = renderRow1('glm', null, 'D:\\project\\java\\project\\code-cli-switch', null);
      // dirName 应该存在
      expect(result).toContain('code-cli-switch');
      // 如果有分支，GREEN_BRIGHT 应该出现
      if (result.includes('(')) {
        expect(result).toContain(GREEN_BRIGHT);
      }
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
