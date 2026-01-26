import { simpleGit, SimpleGit } from 'simple-git';
import type { TaskCommitInput, CommitResult, GitStatusSummary } from './types.js';

/**
 * Get current git status summary
 */
export async function getGitStatus(cwd?: string): Promise<GitStatusSummary> {
  const git: SimpleGit = simpleGit(cwd);
  const status = await git.status();

  return {
    modified: status.modified,
    created: status.not_added,
    deleted: status.deleted,
    staged: status.staged,
    notStaged: [...status.modified, ...status.not_added].filter(f => !status.staged.includes(f))
  };
}

/**
 * Commit task changes atomically
 *
 * NEVER uses git add . - only stages specified files
 * Validates files exist in git status before staging
 */
export async function commitTaskAtomically(
  input: TaskCommitInput,
  cwd?: string
): Promise<CommitResult> {
  const git: SimpleGit = simpleGit(cwd);

  try {
    // Get current status
    const status = await git.status();
    const allChanges = [
      ...status.modified,
      ...status.not_added,
      ...status.created,
      ...status.deleted
    ];

    // Validate all specified files have changes
    const missingFiles = input.files.filter(f => !allChanges.includes(f));
    if (missingFiles.length > 0) {
      return {
        success: false,
        error: `Files not found in git status: ${missingFiles.join(', ')}`
      };
    }

    // Stage only specified files (CRITICAL: never git add .)
    for (const file of input.files) {
      await git.add(file);
    }

    // Build conventional commit message
    const header = `${input.type}(${input.phase}-${input.plan}): ${input.description}`;
    const body = input.bulletPoints.length > 0
      ? '\n\n' + input.bulletPoints.map(bp => `- ${bp}`).join('\n')
      : '';
    const message = header + body;

    // Commit
    const result = await git.commit(message);

    return {
      success: true,
      hash: result.commit
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
