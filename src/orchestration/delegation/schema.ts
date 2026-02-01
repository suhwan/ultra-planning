/**
 * Delegation Schema
 *
 * Zod schemas for runtime validation of delegation configuration.
 */

import { z } from 'zod';

// ============================================================================
// Thinking Budget Schema
// ============================================================================

/** Thinking budget levels */
export const ThinkingBudgetSchema = z.enum(['low', 'medium', 'high', 'max']);

export type ThinkingBudget = z.infer<typeof ThinkingBudgetSchema>;

// ============================================================================
// Category Names Schema
// ============================================================================

/**
 * Builtin category names (9 total)
 * - 7 semantic categories for specific task types
 * - 2 fallback categories for explicit tier requests
 */
export const BuiltinCategoryNameSchema = z.enum([
  'quick',               // Simple lookups, basic operations
  'standard',            // Normal implementation work
  'complex',             // Multi-file changes, refactoring
  'ultrabrain',          // Complex reasoning, architecture, deep debugging
  'visual-engineering',  // UI/UX, frontend, design systems
  'artistry',            // Creative solutions, brainstorming
  'writing',             // Documentation, technical writing
  'unspecified-low',     // Fallback for explicit low-tier requests
  'unspecified-high',    // Fallback for explicit high-tier requests
]);

export type BuiltinCategoryName = z.infer<typeof BuiltinCategoryNameSchema>;

// ============================================================================
// Model Configuration Schema
// ============================================================================

/** Model tier schema */
export const ModelTierSchema = z.enum(['haiku', 'sonnet', 'opus']);

/** Model config within category */
export const ModelConfigSchema = z.object({
  tier: ModelTierSchema,
  temperature: z.number().min(0).max(2),
  thinkingBudget: ThinkingBudgetSchema,
});

export type ValidatedModelConfig = z.infer<typeof ModelConfigSchema>;

// ============================================================================
// Category Configuration Schema
// ============================================================================

/** Full category config */
export const CategoryConfigSchema = z.object({
  category: BuiltinCategoryNameSchema,
  displayName: z.string(),
  description: z.string(),
  model: ModelConfigSchema,
  keywords: z.array(z.string()),
  useCases: z.array(z.string()),
});

export type ValidatedCategoryConfig = z.infer<typeof CategoryConfigSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a category config at runtime.
 * @param config - The config to validate
 * @returns true if valid, false otherwise
 */
export function validateCategoryConfig(config: unknown): boolean {
  return CategoryConfigSchema.safeParse(config).success;
}

/**
 * Parse and validate a category config, throwing on error.
 * @param config - The config to validate
 * @returns Validated config
 * @throws ZodError if validation fails
 */
export function parseCategoryConfig(config: unknown): ValidatedCategoryConfig {
  return CategoryConfigSchema.parse(config);
}

/**
 * Safely parse a category config.
 * @param config - The config to validate
 * @returns SafeParseResult with success/error
 */
export function safeParseCategoryConfig(config: unknown): z.SafeParseReturnType<unknown, ValidatedCategoryConfig> {
  return CategoryConfigSchema.safeParse(config);
}
