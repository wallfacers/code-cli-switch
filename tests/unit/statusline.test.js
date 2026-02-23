import { describe, it, expect } from 'vitest';
import { getVendorColor, formatVendor, injectStatusLine, VENDOR_COLORS } from '../../src/core/statusline.js';

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
});
