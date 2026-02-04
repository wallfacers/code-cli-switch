import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceAdapter } from '../src/core/services/base.js';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

class TestAdapter extends ServiceAdapter {
  constructor(configDir) {
    super();
    this.id = 'test';
    this.name = 'Test';
    this.extension = 'json';
    this.configDir = configDir;
  }
  getConfigDir() { return this.configDir; }
  getTargetPath() { return path.join(this.configDir, 'config.json'); }
  getVariantPath(variant) { return path.join(this.configDir, `config.json.${variant}`); }
  getVariantPattern() { return /^config\.json\.(.+)$/; }
  extractVariantName(filename) { 
    const match = filename.match(/^config\.json\.(.+)$/);
    return match ? match[1] : null;
  }
}

describe('ServiceAdapter.scanVariants', () => {
  let tempDir;
  let adapter;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'cs-cli-scan-test-'));
    adapter = new TestAdapter(tempDir);
    mkdirSync(path.join(tempDir, 'backups'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should identify active variant by hash', () => {
    const variantPath = path.join(tempDir, 'config.json.v1');
    const targetPath = path.join(tempDir, 'config.json');
    writeFileSync(variantPath, 'content');
    writeFileSync(targetPath, 'content');

    const variants = adapter.scanVariants();
    expect(variants).toHaveLength(1);
    expect(variants[0].name).toBe('v1');
    expect(variants[0].active).toBe(true);
  });

  it('should identify current variant by state when hash differs', () => {
    const variantPath = path.join(tempDir, 'config.json.v1');
    const targetPath = path.join(tempDir, 'config.json');
    
    // Different content
    writeFileSync(variantPath, 'content-variant');
    writeFileSync(targetPath, 'content-target');
    
    // Write state
    adapter.writeState('v1', 'somehash');

    const variants = adapter.scanVariants();
    expect(variants).toHaveLength(1);
    expect(variants[0].name).toBe('v1');
    expect(variants[0].active).toBe(false); // Hash differs
    expect(variants[0].current).toBe(true); // Matches state
  });

  it('should prioritize active (hash match) over sorting', () => {
    const v1Path = path.join(tempDir, 'config.json.a');
    const v2Path = path.join(tempDir, 'config.json.b');
    const targetPath = path.join(tempDir, 'config.json');

    writeFileSync(v1Path, 'content-a');
    writeFileSync(v2Path, 'content-b');
    writeFileSync(targetPath, 'content-b'); // Matches b

    const variants = adapter.scanVariants();
    expect(variants[0].name).toBe('b'); // Active comes first
    expect(variants[0].active).toBe(true);
    expect(variants[1].name).toBe('a');
  });

  it('should prioritize current (state match) if no hash match', () => {
    const v1Path = path.join(tempDir, 'config.json.a');
    const v2Path = path.join(tempDir, 'config.json.b');
    const targetPath = path.join(tempDir, 'config.json');

    writeFileSync(v1Path, 'content-a');
    writeFileSync(v2Path, 'content-b');
    writeFileSync(targetPath, 'content-modified'); 

    adapter.writeState('b', 'somehash');

    const variants = adapter.scanVariants();
    // Logic in scanVariants sorts active first, then current first
    expect(variants[0].name).toBe('b'); 
    expect(variants[0].current).toBe(true);
    expect(variants[1].name).toBe('a');
  });
});
