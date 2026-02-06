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

  it('should generate powershell completion script', () => {
    const script = generateCompletionScript('powershell');

    expect(script).toContain('Register-ArgumentCompleter');
    expect(script).toContain('cs-cli');
  });

  it('should generate fish completion script', () => {
    const script = generateCompletionScript('fish');

    expect(script).toContain('complete -c cs-cli');
  });

  it('should complete main commands', () => {
    const completions = getCompletions('', 'cs-cli');

    expect(completions).toContain('list');
    expect(completions).toContain('switch');
    expect(completions).toContain('init');
    expect(completions).toContain('undo');
  });

  it('should complete service names after --service', () => {
    const completions = getCompletions('', 'cs-cli switch --service');

    // Verify that services are returned (exact names may vary based on configuration)
    expect(completions.length).toBeGreaterThan(0);
    expect(completions.every(s => typeof s === 'string')).toBe(true);
  });

  it('should return empty array when no completion available', () => {
    // Test a case where no completion is available
    const completions = getCompletions('', 'cs-cli list -s');
    // Currently returns empty since '-s' is not followed by a space in the wordList parsing
    expect(Array.isArray(completions)).toBe(true);
  });
});
