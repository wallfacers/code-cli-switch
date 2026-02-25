import fs from 'node:fs';
import path from 'node:path';
import { getAdapter } from './registry.js';
import { fileHash } from '../utils/hash.js';
import { createBackup as createBackupForService } from './backup.js';
import { atomicSwitch } from './atomic.js';
import { injectStatusLine } from './statusline.js';
import { detectShell, getShellConfigPath, updateShellConfig, generateExportCommand } from './shell-config.js';

/**
 * Switch configuration using profile isolation (for Claude service)
 * This method does NOT modify the global settings.json, instead:
 * - Uses profiles directory for configuration
 * - Returns export command for shell evaluation
 * - Persists to shell config file
 *
 * @param {ServiceAdapter} adapter - Service adapter instance
 * @param {string} variant - Configuration variant name
 * @param {object} options - { dryRun: boolean }
 * @returns {object}
 */
function switchWithProfile(adapter, variant, options = {}) {
  const { dryRun = false } = options;
  const profilePath = adapter.getProfilePath(variant);
  const profileDir = adapter.getProfileDir(variant);

  // Check if profile exists, if not try to migrate from legacy
  if (!fs.existsSync(profilePath)) {
    const legacyPath = path.join(adapter.getConfigDir(), `settings.json.${variant}`);

    if (fs.existsSync(legacyPath)) {
      // Auto-migrate legacy variant to profile
      const migrateResult = adapter.migrateVariantToProfile(variant);
      if (!migrateResult.success) {
        return {
          success: false,
          error: `Failed to migrate legacy variant: ${migrateResult.error}`
        };
      }
    } else {
      return {
        success: false,
        error: `Configuration variant "${variant}" not found`,
        suggestions: listAvailableVariants(adapter)
      };
    }
  }

  // Validate profile JSON format
  const validation = adapter.validate(profilePath);
  if (!validation.valid) {
    const errorMsg = validation.errors
      ? validation.errors.join('; ')
      : validation.error || 'Unknown validation error';

    return {
      success: false,
      error: `Invalid format in profile ${variant}: ${errorMsg}`
    };
  }

  // Dry-run mode only validates, does not execute
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      service: 'claude',
      message: `Would switch claude to "${variant}" (profile isolation mode)`,
      profileDir,
      profilePath
    };
  }

  try {
    // Inject statusLine into profile settings (not global settings.json)
    const injectResult = injectStatusLine(profilePath, variant);
    if (!injectResult.success) {
      // Injection failure does not block the main flow, just log warning
      console.warn(`Warning: Failed to inject statusLine: ${injectResult.error}`);
    }

    // Update state
    const hash = fileHash(profilePath);
    adapter.writeState(variant, hash);

    // Detect shell type and get config path
    const shellType = detectShell();
    const shellConfigPath = getShellConfigPath(shellType);

    // Persist to shell config file (if supported)
    if (shellConfigPath) {
      updateShellConfig(shellConfigPath, profileDir, shellType);
    }

    // Generate export command for eval
    const exportCommand = generateExportCommand(profileDir, shellType);

    return {
      success: true,
      service: 'claude',
      variant,
      message: `Switched claude to "${variant}" (profile isolation mode)`,
      exportCommand,
      profileDir,
      shellType,
      shellConfigPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to switch: ${error.message}`
    };
  }
}

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

    // 5. Inject statusLine configuration (only for Claude service - but this is legacy mode)
    // Note: In legacy mode, we still inject to global settings.json for backward compatibility
    if (service === 'claude') {
      const injectResult = injectStatusLine(targetPath, variant);
      if (!injectResult.success) {
        // Injection failure does not block the main flow, just log warning
        console.warn(`Warning: Failed to inject statusLine: ${injectResult.error}`);
      }
    }

    // 6. Calculate hash and update state
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
 * Routes to appropriate implementation based on service type:
 * - Claude service: uses profile isolation (switchWithProfile)
 * - Other services: uses legacy mode (switchLegacy)
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

  // Route to appropriate implementation based on service type
  // Claude service uses profile isolation mode
  if (service === 'claude') {
    return switchWithProfile(adapter, variant, options);
  }

  // Other services use legacy mode
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
