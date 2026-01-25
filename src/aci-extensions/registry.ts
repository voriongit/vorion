/**
 * ACI Extension Registry
 *
 * Manages registration, lookup, and validation of ACI extensions.
 * Extensions are identified by their unique extensionId and can also
 * be looked up by their shortcode for ACI string parsing.
 *
 * @packageDocumentation
 * @module @vorion/aci-extensions/registry
 * @license Apache-2.0
 */

import { createLogger } from '../common/logger.js';
import { ValidationError, ConflictError, NotFoundError } from '../common/errors.js';
import type {
  ACIExtension,
  ExtensionInfo,
  ValidationResult,
} from './types.js';
import { ACIExtensionMetadataSchema } from './types.js';
import { isValidExtensionId, isValidShortcode } from './aci-string-extensions.js';

const logger = createLogger({ component: 'aci-extension-registry' });

/**
 * Registry for ACI extensions
 *
 * Provides centralized management of Layer 4 extensions including:
 * - Registration and unregistration
 * - Lookup by ID or shortcode
 * - Validation of extension metadata and structure
 * - Lifecycle management (load/unload hooks)
 *
 * @example
 * ```typescript
 * const registry = new ExtensionRegistry();
 *
 * // Register an extension
 * registry.register(myExtension);
 *
 * // Look up by ID
 * const ext = registry.get('aci-ext-governance-v1');
 *
 * // Look up by shortcode
 * const ext2 = registry.getByShortcode('gov');
 *
 * // List all extensions
 * const all = registry.list();
 * ```
 */
export class ExtensionRegistry {
  /** Map of extensionId to extension instance */
  private extensions: Map<string, ACIExtension> = new Map();

  /** Map of shortcode to extensionId for quick lookup */
  private shortcodes: Map<string, string> = new Map();

  /** Map of extensionId to registration timestamp */
  private registrationTimes: Map<string, Date> = new Map();

  /** Map of extensionId to loaded state */
  private loadedState: Map<string, boolean> = new Map();

  /**
   * Register an extension with the registry
   *
   * Validates the extension metadata and structure, then registers it
   * for use. If the extension has an onLoad hook, it will be called.
   *
   * @param extension - The extension to register
   * @throws {ValidationError} If extension fails validation
   * @throws {ConflictError} If extensionId or shortcode is already registered
   *
   * @example
   * ```typescript
   * registry.register({
   *   extensionId: 'aci-ext-custom-v1',
   *   name: 'Custom Extension',
   *   version: '1.0.0',
   *   shortcode: 'cust',
   *   publisher: 'did:web:example.com',
   *   description: 'A custom extension',
   *   requiredACIVersion: '>=1.0.0',
   * });
   * ```
   */
  async register(extension: ACIExtension): Promise<void> {
    // Validate extension
    const validation = this.validate(extension);
    if (!validation.valid) {
      throw new ValidationError(
        `Extension validation failed: ${validation.errors.join(', ')}`,
        { extensionId: extension.extensionId, errors: validation.errors }
      );
    }

    // Check for duplicate extensionId
    if (this.extensions.has(extension.extensionId)) {
      throw new ConflictError(
        `Extension already registered: ${extension.extensionId}`,
        { extensionId: extension.extensionId }
      );
    }

    // Check for duplicate shortcode
    if (this.shortcodes.has(extension.shortcode)) {
      const existingId = this.shortcodes.get(extension.shortcode);
      throw new ConflictError(
        `Shortcode '${extension.shortcode}' already registered by ${existingId}`,
        { shortcode: extension.shortcode, existingExtensionId: existingId }
      );
    }

    // Register the extension
    this.extensions.set(extension.extensionId, extension);
    this.shortcodes.set(extension.shortcode, extension.extensionId);
    this.registrationTimes.set(extension.extensionId, new Date());
    this.loadedState.set(extension.extensionId, false);

    // Call onLoad hook if present
    if (extension.hooks?.onLoad) {
      try {
        await extension.hooks.onLoad();
        this.loadedState.set(extension.extensionId, true);
        logger.info(
          { extensionId: extension.extensionId, shortcode: extension.shortcode },
          'Extension loaded successfully'
        );
      } catch (error) {
        // Rollback registration on load failure
        this.extensions.delete(extension.extensionId);
        this.shortcodes.delete(extension.shortcode);
        this.registrationTimes.delete(extension.extensionId);
        this.loadedState.delete(extension.extensionId);

        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { extensionId: extension.extensionId, error: message },
          'Extension onLoad hook failed'
        );
        throw new ValidationError(
          `Extension onLoad failed: ${message}`,
          { extensionId: extension.extensionId }
        );
      }
    } else {
      this.loadedState.set(extension.extensionId, true);
      logger.info(
        { extensionId: extension.extensionId, shortcode: extension.shortcode },
        'Extension registered'
      );
    }

    // Log warnings from validation
    if (validation.warnings.length > 0) {
      logger.warn(
        { extensionId: extension.extensionId, warnings: validation.warnings },
        'Extension registered with warnings'
      );
    }
  }

  /**
   * Unregister an extension from the registry
   *
   * If the extension has an onUnload hook, it will be called before removal.
   *
   * @param extensionId - The ID of the extension to unregister
   * @throws {NotFoundError} If extension is not registered
   *
   * @example
   * ```typescript
   * await registry.unregister('aci-ext-custom-v1');
   * ```
   */
  async unregister(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new NotFoundError(
        `Extension not found: ${extensionId}`,
        { extensionId }
      );
    }

    // Call onUnload hook if present
    if (extension.hooks?.onUnload) {
      try {
        await extension.hooks.onUnload();
        logger.info(
          { extensionId },
          'Extension onUnload hook completed'
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { extensionId, error: message },
          'Extension onUnload hook failed (continuing with unregistration)'
        );
      }
    }

    // Remove from registry
    this.shortcodes.delete(extension.shortcode);
    this.extensions.delete(extensionId);
    this.registrationTimes.delete(extensionId);
    this.loadedState.delete(extensionId);

    logger.info({ extensionId }, 'Extension unregistered');
  }

  /**
   * Get an extension by its ID
   *
   * @param extensionId - The extension ID to look up
   * @returns The extension if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const ext = registry.get('aci-ext-governance-v1');
   * if (ext) {
   *   // Use extension
   * }
   * ```
   */
  get(extensionId: string): ACIExtension | undefined {
    return this.extensions.get(extensionId);
  }

  /**
   * Get an extension by its shortcode
   *
   * @param shortcode - The shortcode to look up (e.g., "gov", "audit")
   * @returns The extension if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const ext = registry.getByShortcode('gov');
   * ```
   */
  getByShortcode(shortcode: string): ACIExtension | undefined {
    const extensionId = this.shortcodes.get(shortcode);
    if (!extensionId) {
      return undefined;
    }
    return this.extensions.get(extensionId);
  }

  /**
   * Get extension ID by shortcode
   *
   * @param shortcode - The shortcode to look up
   * @returns The extension ID if found, undefined otherwise
   */
  getIdByShortcode(shortcode: string): string | undefined {
    return this.shortcodes.get(shortcode);
  }

  /**
   * Check if an extension is registered
   *
   * @param extensionId - The extension ID to check
   * @returns True if registered, false otherwise
   */
  has(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }

  /**
   * Check if a shortcode is registered
   *
   * @param shortcode - The shortcode to check
   * @returns True if registered, false otherwise
   */
  hasShortcode(shortcode: string): boolean {
    return this.shortcodes.has(shortcode);
  }

  /**
   * List all registered extensions
   *
   * @returns Array of extension information
   *
   * @example
   * ```typescript
   * const extensions = registry.list();
   * for (const info of extensions) {
   *   console.log(`${info.name} (${info.shortcode})`);
   * }
   * ```
   */
  list(): ExtensionInfo[] {
    const result: ExtensionInfo[] = [];

    for (const [extensionId, extension] of Array.from(this.extensions.entries())) {
      result.push({
        extensionId,
        name: extension.name,
        version: extension.version,
        shortcode: extension.shortcode,
        publisher: extension.publisher,
        description: extension.description,
        registeredAt: this.registrationTimes.get(extensionId) ?? new Date(),
        loaded: this.loadedState.get(extensionId) ?? false,
        hooks: this.getAvailableHooks(extension),
      });
    }

    return result;
  }

  /**
   * Get multiple extensions by their IDs
   *
   * @param extensionIds - Array of extension IDs
   * @returns Array of found extensions (missing ones are omitted)
   */
  getMany(extensionIds: string[]): ACIExtension[] {
    const result: ACIExtension[] = [];
    for (const id of extensionIds) {
      const ext = this.extensions.get(id);
      if (ext) {
        result.push(ext);
      }
    }
    return result;
  }

  /**
   * Get multiple extensions by their shortcodes
   *
   * @param shortcodes - Array of shortcodes
   * @returns Array of found extensions (missing ones are omitted)
   */
  getManyByShortcode(shortcodes: string[]): ACIExtension[] {
    const result: ACIExtension[] = [];
    for (const shortcode of shortcodes) {
      const ext = this.getByShortcode(shortcode);
      if (ext) {
        result.push(ext);
      }
    }
    return result;
  }

  /**
   * Validate an extension's metadata and structure
   *
   * Checks:
   * - Extension ID format (aci-ext-{name}-v{version})
   * - Shortcode format (lowercase, 1-10 chars)
   * - Required metadata fields
   * - Version format (semver)
   * - Hook implementations
   *
   * @param extension - The extension to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const result = registry.validate(myExtension);
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  validate(extension: ACIExtension): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate metadata with Zod
    const metadataResult = ACIExtensionMetadataSchema.safeParse({
      extensionId: extension.extensionId,
      name: extension.name,
      version: extension.version,
      shortcode: extension.shortcode,
      publisher: extension.publisher,
      description: extension.description,
      requiredACIVersion: extension.requiredACIVersion,
    });

    if (!metadataResult.success) {
      for (const issue of metadataResult.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    }

    // Additional validation beyond Zod
    if (!isValidExtensionId(extension.extensionId)) {
      errors.push(
        `Invalid extension ID format: ${extension.extensionId}. Expected: aci-ext-{name}-v{version}`
      );
    }

    if (!isValidShortcode(extension.shortcode)) {
      errors.push(
        `Invalid shortcode format: ${extension.shortcode}. Expected: 1-10 lowercase letters`
      );
    }

    // Validate that extension ID version matches extension.version major
    const idVersionMatch = extension.extensionId.match(/-v(\d+)$/);
    const versionMajor = extension.version.split('.')[0];
    if (idVersionMatch && idVersionMatch[1] !== versionMajor) {
      warnings.push(
        `Extension ID version (v${idVersionMatch[1]}) does not match version major (${versionMajor})`
      );
    }

    // Check for at least one hook implementation
    const hasHooks = this.getAvailableHooks(extension).length > 0;
    if (!hasHooks) {
      warnings.push('Extension has no hook implementations');
    }

    // Validate publisher DID format
    if (!extension.publisher.startsWith('did:')) {
      warnings.push('Publisher should be a DID (e.g., did:web:example.com)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get the count of registered extensions
   *
   * @returns Number of registered extensions
   */
  get size(): number {
    return this.extensions.size;
  }

  /**
   * Clear all registered extensions
   *
   * Calls onUnload for each extension before clearing.
   * Use with caution - primarily for testing.
   */
  async clear(): Promise<void> {
    const extensionIds = Array.from(this.extensions.keys());

    for (const extensionId of extensionIds) {
      try {
        await this.unregister(extensionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { extensionId, error: message },
          'Error unregistering extension during clear'
        );
      }
    }

    this.extensions.clear();
    this.shortcodes.clear();
    this.registrationTimes.clear();
    this.loadedState.clear();

    logger.info('Extension registry cleared');
  }

  /**
   * Get available hooks for an extension
   *
   * @param extension - The extension to check
   * @returns Array of hook names that are implemented
   */
  private getAvailableHooks(extension: ACIExtension): string[] {
    const hooks: string[] = [];

    // Lifecycle hooks
    if (extension.hooks?.onLoad) hooks.push('hooks.onLoad');
    if (extension.hooks?.onUnload) hooks.push('hooks.onUnload');

    // Capability hooks
    if (extension.capability?.preCheck) hooks.push('capability.preCheck');
    if (extension.capability?.postGrant) hooks.push('capability.postGrant');
    if (extension.capability?.onExpiry) hooks.push('capability.onExpiry');

    // Action hooks
    if (extension.action?.preAction) hooks.push('action.preAction');
    if (extension.action?.postAction) hooks.push('action.postAction');
    if (extension.action?.onFailure) hooks.push('action.onFailure');

    // Monitoring hooks
    if (extension.monitoring?.verifyBehavior) hooks.push('monitoring.verifyBehavior');
    if (extension.monitoring?.collectMetrics) hooks.push('monitoring.collectMetrics');
    if (extension.monitoring?.onAnomaly) hooks.push('monitoring.onAnomaly');

    // Trust hooks
    if (extension.trust?.onRevocation) hooks.push('trust.onRevocation');
    if (extension.trust?.adjustTrust) hooks.push('trust.adjustTrust');
    if (extension.trust?.verifyAttestation) hooks.push('trust.verifyAttestation');

    // Policy engine
    if (extension.policy?.evaluate) hooks.push('policy.evaluate');
    if (extension.policy?.loadPolicy) hooks.push('policy.loadPolicy');

    return hooks;
  }
}

/**
 * Create a new extension registry instance
 *
 * @returns A new ExtensionRegistry instance
 *
 * @example
 * ```typescript
 * const registry = createExtensionRegistry();
 * await registry.register(myExtension);
 * ```
 */
export function createExtensionRegistry(): ExtensionRegistry {
  return new ExtensionRegistry();
}
