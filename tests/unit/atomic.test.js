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
