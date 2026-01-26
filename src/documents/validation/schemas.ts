/**
 * Zod Schemas for Document Validation
 *
 * Runtime validation schemas for PLAN.md frontmatter and related structures.
 */

import { z } from 'zod';
import type { Artifact, KeyLink, MustHaves } from '../../types.js';

// ============================================================================
// Artifact Schema
// ============================================================================

/**
 * Artifact schema - files that must exist with real implementation
 */
export const ArtifactSchema = z.object({
  /** File path relative to project root */
  path: z.string(),

  /** What this artifact delivers */
  provides: z.string(),

  /** Optional pattern that must exist in file */
  contains: z.string().optional(),

  /** Optional expected exports to verify */
  exports: z.array(z.string()).optional(),

  /** Optional minimum lines to be considered substantive */
  min_lines: z.number().int().positive().optional(),
});

// ============================================================================
// Key Link Schema
// ============================================================================

/**
 * Key link schema - critical connections between artifacts
 */
export const KeyLinkSchema = z.object({
  /** Source artifact */
  from: z.string(),

  /** Target artifact or endpoint */
  to: z.string(),

  /** How they connect (description) */
  via: z.string(),

  /** Optional regex to verify connection exists */
  pattern: z.string().optional(),
});

// ============================================================================
// Must-Haves Schema
// ============================================================================

/**
 * Must-haves schema - goal-backward verification requirements
 */
export const MustHavesSchema = z.object({
  /** Observable behaviors from user perspective */
  truths: z.array(z.string()),

  /** Files that must exist with real implementation */
  artifacts: z.array(ArtifactSchema),

  /** Critical connections between artifacts */
  key_links: z.array(KeyLinkSchema).optional(),
});

// ============================================================================
// Plan Frontmatter Schema
// ============================================================================

/**
 * Plan frontmatter schema - complete YAML frontmatter validation
 */
export const PlanFrontmatterSchema = z.object({
  /** Phase identifier (e.g., "01-foundation") */
  phase: z.string(),

  /** Plan number within phase */
  plan: z.number().int().positive(),

  /** Plan type */
  type: z.enum(['execute', 'tdd']),

  /** Execution wave number (1, 2, 3...) */
  wave: z.number().int().positive(),

  /** Array of plan IDs this plan requires */
  depends_on: z.array(z.string()),

  /** Files this plan modifies */
  files_modified: z.array(z.string()),

  /** True if no checkpoints, false if has checkpoints */
  autonomous: z.boolean(),

  /** Optional human-required setup items */
  user_setup: z
    .array(
      z.object({
        service: z.string(),
        why: z.string(),
        env_vars: z
          .array(
            z.object({
              name: z.string(),
              source: z.string(),
            })
          )
          .optional(),
        dashboard_config: z
          .array(
            z.object({
              task: z.string(),
              location: z.string(),
              details: z.string().optional(),
            })
          )
          .optional(),
        local_dev: z.array(z.string()).optional(),
      })
    )
    .optional(),

  /** Goal-backward verification requirements */
  must_haves: MustHavesSchema,
});

export type ValidatedPlanFrontmatter = z.infer<typeof PlanFrontmatterSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate plan frontmatter
 */
export function validatePlanFrontmatter(data: unknown): ValidatedPlanFrontmatter {
  return PlanFrontmatterSchema.parse(data);
}

/**
 * Safe validation that returns success/error result
 */
export function safeParsePlanFrontmatter(
  data: unknown
): z.SafeParseReturnType<unknown, ValidatedPlanFrontmatter> {
  return PlanFrontmatterSchema.safeParse(data);
}

/**
 * Validate must-haves section
 */
export function validateMustHaves(data: unknown): MustHaves {
  return MustHavesSchema.parse(data);
}

/**
 * Validate artifact
 */
export function validateArtifact(data: unknown): Artifact {
  return ArtifactSchema.parse(data) as Artifact;
}

/**
 * Validate key link
 */
export function validateKeyLink(data: unknown): KeyLink {
  return KeyLinkSchema.parse(data) as KeyLink;
}
