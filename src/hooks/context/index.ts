/**
 * Context Injection Hooks
 *
 * Hooks for context management:
 * - compaction-context-injector: Preserve context during compaction
 * - keyword-detector: Detect magic keywords for mode activation
 * - directory-agents-injector: Inject AGENTS.md content for directory context
 *
 * These hooks manage context enrichment and preservation during
 * agent execution and session lifecycle.
 *
 * @module hooks/context
 *
 * @example
 * import {
 *   createCompactionContextInjectorHook,
 *   createKeywordDetectorHook,
 *   createDirectoryAgentsInjectorHook,
 * } from 'ultra-planner/hooks';
 *
 * // Register hooks with the registry
 * registry.register({
 *   name: 'keyword-detector',
 *   enabled: true,
 *   priority: 50,  // Run early to detect modes
 *   factory: (ctx) => createKeywordDetectorHook(ctx),
 * });
 */

export * from './compaction-context-injector.js';
export * from './keyword-detector.js';
export * from './directory-agents-injector.js';
