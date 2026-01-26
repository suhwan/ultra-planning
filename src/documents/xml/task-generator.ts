/**
 * XML Task Generator
 *
 * Generates task XML from Task objects for PLAN.md documents.
 */

import type {
  Task,
  AutoTask,
  CheckpointTask,
  HumanVerifyTask,
  DecisionTask,
  HumanActionTask,
} from './types.js';

// ============================================================================
// XML Escaping
// ============================================================================

/**
 * Escape special XML characters in user content
 *
 * @param str - String to escape
 * @returns Escaped string safe for XML
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Task Generation
// ============================================================================

/**
 * Generate XML for autonomous task
 *
 * @param task - Auto task object
 * @returns XML string for task
 */
function generateAutoTaskXml(task: AutoTask): string {
  const filesStr = task.files.join(', ');

  return `<task type="auto">
  <name>${escapeXml(task.name)}</name>
  <files>${escapeXml(filesStr)}</files>
  <action>
${escapeXml(task.action)}
  </action>
  <verify>${escapeXml(task.verify)}</verify>
  <done>${escapeXml(task.done)}</done>
</task>`;
}

/**
 * Generate XML for human-verify checkpoint
 *
 * @param task - Human-verify task object
 * @returns XML string for task
 */
function generateHumanVerifyTaskXml(task: HumanVerifyTask): string {
  return `<task type="checkpoint:human-verify" gate="${task.gate}">
  <what-built>${escapeXml(task.whatBuilt)}</what-built>
  <how-to-verify>${escapeXml(task.howToVerify)}</how-to-verify>
  <resume-signal>${escapeXml(task.resumeSignal)}</resume-signal>
</task>`;
}

/**
 * Generate XML for decision checkpoint
 *
 * @param task - Decision task object
 * @returns XML string for task
 */
function generateDecisionTaskXml(task: DecisionTask): string {
  const optionsXml = task.options
    .map(
      (opt) =>
        `    <option id="${escapeXml(opt.id)}"><name>${escapeXml(opt.name)}</name><pros>${escapeXml(opt.pros)}</pros><cons>${escapeXml(opt.cons)}</cons></option>`
    )
    .join('\n');

  return `<task type="checkpoint:decision" gate="${task.gate}">
  <decision>${escapeXml(task.decision)}</decision>
  <context>${escapeXml(task.context)}</context>
  <options>
${optionsXml}
  </options>
  <resume-signal>${escapeXml(task.resumeSignal)}</resume-signal>
</task>`;
}

/**
 * Generate XML for human-action checkpoint
 *
 * @param task - Human-action task object
 * @returns XML string for task
 */
function generateHumanActionTaskXml(task: HumanActionTask): string {
  return `<task type="checkpoint:human-action" gate="${task.gate}">
  <action>${escapeXml(task.action)}</action>
  <instructions>${escapeXml(task.instructions)}</instructions>
  <resume-signal>${escapeXml(task.resumeSignal)}</resume-signal>
</task>`;
}

/**
 * Generate XML for checkpoint task (dispatcher)
 *
 * @param task - Checkpoint task object
 * @returns XML string for task
 */
function generateCheckpointTaskXml(task: CheckpointTask): string {
  switch (task.type) {
    case 'checkpoint:human-verify':
      return generateHumanVerifyTaskXml(task);
    case 'checkpoint:decision':
      return generateDecisionTaskXml(task);
    case 'checkpoint:human-action':
      return generateHumanActionTaskXml(task);
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = task;
      throw new Error(`Unknown checkpoint type: ${(_exhaustive as any).type}`);
  }
}

/**
 * Generate XML for any task type
 *
 * @param task - Task object (auto or checkpoint)
 * @returns XML string for task
 */
export function generateTaskXml(task: Task): string {
  if (task.type === 'auto') {
    return generateAutoTaskXml(task);
  } else {
    return generateCheckpointTaskXml(task);
  }
}

/**
 * Generate complete tasks section with all tasks
 *
 * @param tasks - Array of task objects
 * @returns Complete <tasks> XML section
 */
export function generateTasksSection(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '<tasks>\n\n</tasks>';
  }

  const taskXmls = tasks.map((task) => generateTaskXml(task));

  return `<tasks>

${taskXmls.join('\n\n')}

</tasks>`;
}
