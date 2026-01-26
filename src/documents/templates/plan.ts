/**
 * PLAN.md Generator and Parser
 *
 * Generates and parses PLAN.md documents with YAML frontmatter.
 * Uses gray-matter for frontmatter handling.
 */

import matter from 'gray-matter';
import type { PlanDocument, TaskDefinition } from '../types.js';
import type { PlanFrontmatter } from '../../types.js';

/**
 * Generate PLAN.md markdown from document
 */
export function generatePlanMd(doc: PlanDocument): string {
  // Use gray-matter to combine frontmatter and content
  const markdown = matter.stringify(doc.content, doc.frontmatter as any);
  return markdown;
}

/**
 * Parse PLAN.md markdown into document
 */
export function parsePlanMd(markdown: string): PlanDocument {
  const parsed = matter(markdown);

  return {
    frontmatter: parsed.data as PlanFrontmatter,
    content: parsed.content,
  };
}

/**
 * Generate complete PLAN.md from structured data
 */
export function generateCompletePlanMd(
  frontmatter: PlanFrontmatter,
  options: {
    objective: {
      description: string;
      purpose: string;
      output: string;
    };
    executionContext?: string[];
    context: string[];
    tasks: TaskDefinition[];
    verification: string[];
    successCriteria: string[];
    output: string;
  }
): string {
  const content = `<objective>
${options.objective.description}

Purpose: ${options.objective.purpose}
Output: ${options.objective.output}
</objective>

${
  options.executionContext && options.executionContext.length > 0
    ? `<execution_context>
${options.executionContext.map((ref) => `@${ref}`).join('\n')}
</execution_context>

`
    : ''
}<context>
${options.context.map((ref) => `@${ref}`).join('\n')}
</context>

<tasks>

${options.tasks.map((task) => generateTaskXml(task)).join('\n\n')}

</tasks>

<verification>
Before declaring plan complete:
${options.verification.map((item) => `- [ ] ${item}`).join('\n')}
</verification>

<success_criteria>

${options.successCriteria.map((item) => `- ${item}`).join('\n')}
</success_criteria>

<output>
${options.output}
</output>
`;

  return generatePlanMd({ frontmatter, content });
}

/**
 * Generate XML for a single task
 */
function generateTaskXml(task: TaskDefinition): string {
  if (task.type === 'auto') {
    return `<task type="auto">
  <name>${escapeXml(task.name)}</name>
  ${task.files ? `<files>${escapeXml(task.files.join(', '))}</files>` : ''}
  ${task.action ? `<action>${escapeXml(task.action)}</action>` : ''}
  ${task.verify ? `<verify>${escapeXml(task.verify)}</verify>` : ''}
  ${task.done ? `<done>${escapeXml(task.done)}</done>` : ''}
</task>`;
  }

  if (task.type === 'checkpoint:decision' && task.checkpoint?.decision) {
    const gate = task.checkpoint.gate || 'blocking';
    return `<task type="checkpoint:decision" gate="${gate}">
  <decision>${escapeXml(task.checkpoint.decision)}</decision>
  ${task.checkpoint.context ? `<context>${escapeXml(task.checkpoint.context)}</context>` : ''}
  ${
    task.checkpoint.options
      ? `<options>
${task.checkpoint.options
  .map(
    (opt) => `    <option id="${opt.id}">
      <name>${escapeXml(opt.name)}</name>
      <pros>${escapeXml(opt.pros)}</pros>
      <cons>${escapeXml(opt.cons)}</cons>
    </option>`
  )
  .join('\n')}
  </options>`
      : ''
  }
  ${task.checkpoint.resumeSignal ? `<resume-signal>${escapeXml(task.checkpoint.resumeSignal)}</resume-signal>` : ''}
</task>`;
  }

  if (task.type === 'checkpoint:human-verify' && task.checkpoint) {
    const gate = task.checkpoint.gate || 'blocking';
    return `<task type="checkpoint:human-verify" gate="${gate}">
  ${task.checkpoint.whatBuilt ? `<what-built>${escapeXml(task.checkpoint.whatBuilt)}</what-built>` : ''}
  ${task.checkpoint.howToVerify ? `<how-to-verify>${escapeXml(task.checkpoint.howToVerify)}</how-to-verify>` : ''}
  ${task.checkpoint.resumeSignal ? `<resume-signal>${escapeXml(task.checkpoint.resumeSignal)}</resume-signal>` : ''}
</task>`;
  }

  if (task.type === 'checkpoint:human-action' && task.checkpoint) {
    const gate = task.checkpoint.gate || 'blocking';
    return `<task type="checkpoint:human-action" gate="${gate}">
  ${task.action ? `<action>${escapeXml(task.action)}</action>` : ''}
  ${task.checkpoint.resumeSignal ? `<resume-signal>${escapeXml(task.checkpoint.resumeSignal)}</resume-signal>` : ''}
</task>`;
  }

  // Fallback for unknown task types
  return `<task type="${task.type}">
  <name>${escapeXml(task.name)}</name>
</task>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Extract task information from content
 * (Basic parser - can be enhanced as needed)
 */
export function extractTasksFromContent(content: string): TaskDefinition[] {
  const tasks: TaskDefinition[] = [];

  // Simple regex to extract auto tasks
  const autoTaskRegex =
    /<task type="auto">\s*<name>(.*?)<\/name>\s*(?:<files>(.*?)<\/files>)?\s*(?:<action>(.*?)<\/action>)?\s*(?:<verify>(.*?)<\/verify>)?\s*(?:<done>(.*?)<\/done>)?\s*<\/task>/gs;

  let match;
  while ((match = autoTaskRegex.exec(content)) !== null) {
    tasks.push({
      type: 'auto',
      name: unescapeXml(match[1].trim()),
      files: match[2] ? match[2].split(',').map((f) => f.trim()) : undefined,
      action: match[3] ? unescapeXml(match[3].trim()) : undefined,
      verify: match[4] ? unescapeXml(match[4].trim()) : undefined,
      done: match[5] ? unescapeXml(match[5].trim()) : undefined,
    });
  }

  return tasks;
}

/**
 * Unescape XML special characters
 */
function unescapeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
