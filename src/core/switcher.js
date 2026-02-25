import fs from 'node:fs';
import path from 'node:path';
import { getAdapter } from './registry.js';
import { fileHash } from '../utils/hash.js';
import { createBackup as createBackupForService } from './backup.js';
import { atomicSwitch } from './atomic.js';

/**
 * Switch configuration using legacy mode (for non-Claude services)
 * This is the original behavior that modifies the global config file.
 *
 * @param {ServiceAdapter} adapter - Service adapter instance
 * @param {string} service - Service identifier
 * @param {string} variant - Configuration variant name
 * @param {object} options - { dryRun: boolean, noBackup: boolean }
 * @returns {object}
 */
function switchLegacy(adapter, service, variant, options = {}) {
  const { dryRun = false, noBackup = false } = options;

  const sourcePath = adapter.getVariantPath(variant);
  const targetPath = adapter.getTargetPath();

  // 1. Check if source file exists
  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      error: `Configuration variant "${variant}" not found`,
      suggestions: listAvailableVariants(adapter)
    };
  }

  // 2. Format validation
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

  // Dry-run mode only validates, does not execute
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

  // 3. Backup current configuration
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
    // 4. Atomic switch operation
    atomicSwitch(sourcePath, targetPath);

    // 5. Calculate hash and update state
    const hash = fileHash(targetPath);
    adapter.writeState(variant, hash);

    // 7. Codex special handling: update auth.json
    if (service === 'codex' && typeof adapter.updateAuthJson === 'function') {
      const authResult = adapter.updateAuthJson(targetPath);
      if (!authResult.success) {
        // auth.json update failure does not block the main flow, but log warning
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
  }
}

/**
 * Switch to specified configuration
 *
 * @param {string} service - Service identifier (claude/gemini/codex), defaults to claude
 * @param {string} variant - Configuration variant name
 * @param {object} options - { dryRun: boolean, noBackup: boolean }
 * @returns {object}
 */
export function switchConfig(service, variant, options = {}) {
  // Compatibility with old interface: if second argument is object, service was not passed
  if (typeof variant === 'object') {
    options = variant;
    variant = service;
    service = 'claude';
  }

  const adapter = getAdapter(service);
  if (!adapter) {
    return {
      success: false,
      error: `Unknown coding tool: "${service}"`,
      suggestions: listAvailableServices()
    };
  }

  // All services use legacy mode
  return switchLegacy(adapter, service, variant, options);
}

/**
 * Preview switch differences
 * @param {string} service - Service identifier
 * @param {string} variant
 * @returns {object}
 */
export function previewSwitch(service, variant) {
  return switchConfig(service, variant, { dryRun: true });
}

/**
 * List available services
 * @returns {Array<string>}
 */
function listAvailableServices() {
  const { listServices } = require('./registry.js');
  return listServices().map(s => s.id);
}

/**
 * List available configuration variants for specified service
 * @param {ServiceAdapter} adapter
 * @returns {Array<string>}
 */
function listAvailableVariants(adapter) {
  return adapter.scanVariants().map(v => v.name);
}
