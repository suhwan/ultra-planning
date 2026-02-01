/**
 * Zod Schema Validation Tests
 *
 * Tests for PLAN.md frontmatter and related structure validation.
 */

import { describe, it, expect } from 'vitest';
import {
  ArtifactSchema,
  KeyLinkSchema,
  MustHavesSchema,
  PlanFrontmatterSchema,
  validatePlanFrontmatter,
  safeParsePlanFrontmatter,
  validateMustHaves,
  validateArtifact,
  validateKeyLink,
} from './schemas.js';

// ============================================================================
// ArtifactSchema Tests
// ============================================================================

describe('ArtifactSchema', () => {
  it('should validate artifact with all fields', () => {
    const artifact = {
      path: 'src/component.ts',
      provides: 'Main component implementation',
      contains: 'export class Component',
      exports: ['Component', 'ComponentProps'],
      min_lines: 50,
    };

    const result = ArtifactSchema.safeParse(artifact);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.path).toBe('src/component.ts');
      expect(result.data.min_lines).toBe(50);
    }
  });

  it('should validate artifact with only required fields', () => {
    const artifact = {
      path: 'src/utils.ts',
      provides: 'Utility functions',
    };

    const result = ArtifactSchema.safeParse(artifact);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contains).toBeUndefined();
      expect(result.data.exports).toBeUndefined();
      expect(result.data.min_lines).toBeUndefined();
    }
  });

  it('should reject artifact missing required path', () => {
    const artifact = {
      provides: 'Missing path field',
    };

    const result = ArtifactSchema.safeParse(artifact);
    expect(result.success).toBe(false);
  });

  it('should reject artifact with negative min_lines', () => {
    const artifact = {
      path: 'src/file.ts',
      provides: 'Something',
      min_lines: -10,
    };

    const result = ArtifactSchema.safeParse(artifact);
    expect(result.success).toBe(false);
  });

  it('should reject artifact with zero min_lines', () => {
    const artifact = {
      path: 'src/file.ts',
      provides: 'Something',
      min_lines: 0,
    };

    const result = ArtifactSchema.safeParse(artifact);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// KeyLinkSchema Tests
// ============================================================================

describe('KeyLinkSchema', () => {
  it('should validate key link with all fields', () => {
    const keyLink = {
      from: 'src/api/handler.ts',
      to: 'src/db/repository.ts',
      via: 'imports repository for data access',
      pattern: 'import.*Repository.*from',
    };

    const result = KeyLinkSchema.safeParse(keyLink);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.from).toBe('src/api/handler.ts');
      expect(result.data.pattern).toBe('import.*Repository.*from');
    }
  });

  it('should validate key link without optional pattern', () => {
    const keyLink = {
      from: 'src/service.ts',
      to: 'src/model.ts',
      via: 'uses model types',
    };

    const result = KeyLinkSchema.safeParse(keyLink);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pattern).toBeUndefined();
    }
  });

  it('should reject key link missing from field', () => {
    const keyLink = {
      to: 'src/target.ts',
      via: 'some connection',
    };

    const result = KeyLinkSchema.safeParse(keyLink);
    expect(result.success).toBe(false);
  });

  it('should reject key link missing to field', () => {
    const keyLink = {
      from: 'src/source.ts',
      via: 'some connection',
    };

    const result = KeyLinkSchema.safeParse(keyLink);
    expect(result.success).toBe(false);
  });

  it('should reject key link missing via field', () => {
    const keyLink = {
      from: 'src/source.ts',
      to: 'src/target.ts',
    };

    const result = KeyLinkSchema.safeParse(keyLink);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// MustHavesSchema Tests
// ============================================================================

describe('MustHavesSchema', () => {
  it('should validate must_haves with all sections', () => {
    const mustHaves = {
      truths: ['User can login', 'User can logout'],
      artifacts: [
        { path: 'src/auth.ts', provides: 'Auth logic' },
        { path: 'src/session.ts', provides: 'Session management' },
      ],
      key_links: [
        { from: 'src/auth.ts', to: 'src/session.ts', via: 'creates sessions' },
      ],
    };

    const result = MustHavesSchema.safeParse(mustHaves);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.truths).toHaveLength(2);
      expect(result.data.artifacts).toHaveLength(2);
      expect(result.data.key_links).toHaveLength(1);
    }
  });

  it('should validate must_haves without optional key_links', () => {
    const mustHaves = {
      truths: ['Feature works as expected'],
      artifacts: [{ path: 'src/feature.ts', provides: 'Feature implementation' }],
    };

    const result = MustHavesSchema.safeParse(mustHaves);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key_links).toBeUndefined();
    }
  });

  it('should reject must_haves with missing truths', () => {
    const mustHaves = {
      artifacts: [{ path: 'src/file.ts', provides: 'Something' }],
    };

    const result = MustHavesSchema.safeParse(mustHaves);
    expect(result.success).toBe(false);
  });

  it('should reject must_haves with missing artifacts', () => {
    const mustHaves = {
      truths: ['Some truth'],
    };

    const result = MustHavesSchema.safeParse(mustHaves);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// PlanFrontmatterSchema Tests
// ============================================================================

describe('PlanFrontmatterSchema', () => {
  const validFrontmatter = {
    phase: '01-foundation',
    plan: 1,
    type: 'execute' as const,
    wave: 1,
    depends_on: [],
    files_modified: ['src/index.ts'],
    autonomous: true,
    must_haves: {
      truths: ['System initializes correctly'],
      artifacts: [{ path: 'src/index.ts', provides: 'Entry point' }],
    },
  };

  it('should validate complete frontmatter', () => {
    const result = PlanFrontmatterSchema.safeParse(validFrontmatter);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phase).toBe('01-foundation');
      expect(result.data.plan).toBe(1);
      expect(result.data.type).toBe('execute');
    }
  });

  it('should validate frontmatter with user_setup', () => {
    const withUserSetup = {
      ...validFrontmatter,
      user_setup: [
        {
          service: 'AWS S3',
          why: 'File storage',
          env_vars: [{ name: 'AWS_BUCKET', source: 'AWS Console' }],
        },
      ],
    };

    const result = PlanFrontmatterSchema.safeParse(withUserSetup);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user_setup).toHaveLength(1);
      expect(result.data.user_setup![0].service).toBe('AWS S3');
    }
  });

  it('should reject frontmatter with wave 0', () => {
    const invalid = { ...validFrontmatter, wave: 0 };
    const result = PlanFrontmatterSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject frontmatter with negative wave', () => {
    const invalid = { ...validFrontmatter, wave: -1 };
    const result = PlanFrontmatterSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject frontmatter with invalid type', () => {
    const invalid = { ...validFrontmatter, type: 'invalid' };
    const result = PlanFrontmatterSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept frontmatter with tdd type', () => {
    const tddFrontmatter = { ...validFrontmatter, type: 'tdd' as const };
    const result = PlanFrontmatterSchema.safeParse(tddFrontmatter);
    expect(result.success).toBe(true);
  });

  it('should reject frontmatter missing required fields', () => {
    const { phase, ...missingPhase } = validFrontmatter;
    const result = PlanFrontmatterSchema.safeParse(missingPhase);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('validatePlanFrontmatter', () => {
  it('should return validated data for valid input', () => {
    const validFrontmatter = {
      phase: '02-core',
      plan: 2,
      type: 'execute' as const,
      wave: 1,
      depends_on: ['01-01'],
      files_modified: ['src/core.ts'],
      autonomous: false,
      must_haves: {
        truths: ['Core functionality works'],
        artifacts: [{ path: 'src/core.ts', provides: 'Core module' }],
      },
    };

    const result = validatePlanFrontmatter(validFrontmatter);
    expect(result.phase).toBe('02-core');
    expect(result.plan).toBe(2);
  });

  it('should throw on invalid input', () => {
    const invalid = { phase: 123, plan: 'not a number' };
    expect(() => validatePlanFrontmatter(invalid)).toThrow();
  });
});

describe('safeParsePlanFrontmatter', () => {
  it('should return success result for valid input', () => {
    const validFrontmatter = {
      phase: '03-features',
      plan: 1,
      type: 'execute' as const,
      wave: 2,
      depends_on: [],
      files_modified: [],
      autonomous: true,
      must_haves: {
        truths: ['Feature complete'],
        artifacts: [{ path: 'src/feature.ts', provides: 'Feature' }],
      },
    };

    const result = safeParsePlanFrontmatter(validFrontmatter);
    expect(result.success).toBe(true);
  });

  it('should return error result for invalid input', () => {
    const invalid = { invalid: true };
    const result = safeParsePlanFrontmatter(invalid);
    expect(result.success).toBe(false);
  });
});

describe('validateMustHaves', () => {
  it('should validate valid must_haves', () => {
    const mustHaves = {
      truths: ['It works'],
      artifacts: [{ path: 'src/it.ts', provides: 'It implementation' }],
    };

    const result = validateMustHaves(mustHaves);
    expect(result.truths).toHaveLength(1);
    expect(result.artifacts).toHaveLength(1);
  });

  it('should throw for invalid must_haves', () => {
    expect(() => validateMustHaves({})).toThrow();
  });
});

describe('validateArtifact', () => {
  it('should validate valid artifact', () => {
    const artifact = { path: 'src/test.ts', provides: 'Test file' };
    const result = validateArtifact(artifact);
    expect(result.path).toBe('src/test.ts');
  });

  it('should throw for invalid artifact', () => {
    expect(() => validateArtifact({ provides: 'no path' })).toThrow();
  });
});

describe('validateKeyLink', () => {
  it('should validate valid key link', () => {
    const keyLink = { from: 'a.ts', to: 'b.ts', via: 'imports' };
    const result = validateKeyLink(keyLink);
    expect(result.from).toBe('a.ts');
  });

  it('should throw for invalid key link', () => {
    expect(() => validateKeyLink({ from: 'a.ts' })).toThrow();
  });
});
