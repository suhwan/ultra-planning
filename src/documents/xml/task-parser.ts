/**
 * XML Task Parser
 *
 * Parses task XML from PLAN.md documents back to Task objects.
 * Uses regex-based parsing (not DOM parser) for custom XML format.
 */

import type {
  Task,
  AutoTask,
  CheckpointTask,
  HumanVerifyTask,
  DecisionTask,
  HumanActionTask,
  DecisionOption,
} from './types.js';

// ============================================================================
// XML Unescaping
// ============================================================================

/**
 * Unescape XML entities back to original characters
 *
 * @param str - Escaped XML string
 * @returns Unescaped string
 */
export function unescapeXml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

// ============================================================================
// Extraction Helpers
// ============================================================================

/**
 * Extract content between XML tags
 *
 * @param xml - XML string
 * @param tagName - Tag name to extract
 * @returns Extracted content (unescaped) or undefined
 */
function extractTag(xml: string, tagName: string): string | undefined {
  // Handle both self-closing and content tags
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);

  if (!match) {
    return undefined;
  }

  return unescapeXml(match[1].trim());
}

/**
 * Extract attribute from tag
 *
 * @param xml - XML string containing tag
 * @param attrName - Attribute name
 * @returns Attribute value or undefined
 */
function extractAttribute(xml: string, attrName: string): string | undefined {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : undefined;
}

// ============================================================================
// Task Parsing
// ============================================================================

/**
 * Parse autonomous task XML
 *
 * @param xml - Task XML string
 * @param name - Task name (already extracted)
 * @returns Parsed AutoTask object
 * @throws Error if required fields missing
 */
function parseAutoTask(xml: string, name: string): AutoTask {
  const filesStr = extractTag(xml, 'files');
  const action = extractTag(xml, 'action');
  const verify = extractTag(xml, 'verify');
  const done = extractTag(xml, 'done');

  if (!filesStr) {
    throw new Error(`Auto task missing <files>: ${name}`);
  }
  if (!action) {
    throw new Error(`Auto task missing <action>: ${name}`);
  }
  if (!verify) {
    throw new Error(`Auto task missing <verify>: ${name}`);
  }
  if (!done) {
    throw new Error(`Auto task missing <done>: ${name}`);
  }

  // Parse comma-separated files
  const files = filesStr
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  return {
    type: 'auto',
    name,
    files,
    action,
    verify,
    done,
  };
}

/**
 * Parse human-verify checkpoint XML
 *
 * @param xml - Task XML string
 * @param name - Task name (already extracted)
 * @returns Parsed HumanVerifyTask object
 * @throws Error if required fields missing
 */
function parseHumanVerifyTask(xml: string, name: string): HumanVerifyTask {
  const whatBuilt = extractTag(xml, 'what-built');
  const howToVerify = extractTag(xml, 'how-to-verify');
  const resumeSignal = extractTag(xml, 'resume-signal');
  const gate = extractAttribute(xml, 'gate') as 'blocking' | undefined;

  if (!whatBuilt) {
    throw new Error(`Human-verify task missing <what-built>: ${name}`);
  }
  if (!howToVerify) {
    throw new Error(`Human-verify task missing <how-to-verify>: ${name}`);
  }
  if (!resumeSignal) {
    throw new Error(`Human-verify task missing <resume-signal>: ${name}`);
  }

  return {
    type: 'checkpoint:human-verify',
    name,
    gate: gate || 'blocking',
    whatBuilt,
    howToVerify,
    resumeSignal,
  };
}

/**
 * Parse decision options from XML
 *
 * @param optionsXml - Options section XML
 * @returns Array of DecisionOption objects
 */
function parseDecisionOptions(optionsXml: string): DecisionOption[] {
  const optionRegex = /<option\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi;
  const options: DecisionOption[] = [];

  let match: RegExpExecArray | null;
  while ((match = optionRegex.exec(optionsXml)) !== null) {
    const id = match[1];
    const optionContent = match[2];

    const name = extractTag(optionContent, 'name');
    const pros = extractTag(optionContent, 'pros');
    const cons = extractTag(optionContent, 'cons');

    if (!name || !pros || !cons) {
      throw new Error(`Invalid option format for id: ${id}`);
    }

    options.push({ id, name, pros, cons });
  }

  return options;
}

/**
 * Parse decision checkpoint XML
 *
 * @param xml - Task XML string
 * @param name - Task name (already extracted)
 * @returns Parsed DecisionTask object
 * @throws Error if required fields missing
 */
function parseDecisionTask(xml: string, name: string): DecisionTask {
  const decision = extractTag(xml, 'decision');
  const context = extractTag(xml, 'context');
  const optionsXml = extractTag(xml, 'options');
  const resumeSignal = extractTag(xml, 'resume-signal');
  const gate = extractAttribute(xml, 'gate') as 'blocking' | undefined;

  if (!decision) {
    throw new Error(`Decision task missing <decision>: ${name}`);
  }
  if (!context) {
    throw new Error(`Decision task missing <context>: ${name}`);
  }
  if (!optionsXml) {
    throw new Error(`Decision task missing <options>: ${name}`);
  }
  if (!resumeSignal) {
    throw new Error(`Decision task missing <resume-signal>: ${name}`);
  }

  const options = parseDecisionOptions(optionsXml);

  if (options.length === 0) {
    throw new Error(`Decision task has no options: ${name}`);
  }

  return {
    type: 'checkpoint:decision',
    name,
    gate: gate || 'blocking',
    decision,
    context,
    options,
    resumeSignal,
  };
}

/**
 * Parse human-action checkpoint XML
 *
 * @param xml - Task XML string
 * @param name - Task name (already extracted)
 * @returns Parsed HumanActionTask object
 * @throws Error if required fields missing
 */
function parseHumanActionTask(xml: string, name: string): HumanActionTask {
  const action = extractTag(xml, 'action');
  const instructions = extractTag(xml, 'instructions');
  const resumeSignal = extractTag(xml, 'resume-signal');
  const gate = extractAttribute(xml, 'gate') as 'blocking' | undefined;

  if (!action) {
    throw new Error(`Human-action task missing <action>: ${name}`);
  }
  if (!instructions) {
    throw new Error(`Human-action task missing <instructions>: ${name}`);
  }
  if (!resumeSignal) {
    throw new Error(`Human-action task missing <resume-signal>: ${name}`);
  }

  return {
    type: 'checkpoint:human-action',
    name,
    gate: gate || 'blocking',
    action,
    instructions,
    resumeSignal,
  };
}

/**
 * Parse single task XML to Task object
 *
 * @param xml - Complete task XML string (including <task> tags)
 * @returns Parsed Task object
 * @throws Error if parsing fails
 */
export function parseTaskXml(xml: string): Task {
  // Extract type attribute
  const typeAttr = extractAttribute(xml, 'type');
  if (!typeAttr) {
    throw new Error('Task missing type attribute');
  }

  // Extract name (only for auto tasks, checkpoints don't have names)
  // For auto tasks, extract the direct child <name> tag
  // For checkpoints, use a default name based on the checkpoint type
  let name: string;
  if (typeAttr === 'auto') {
    name = extractTag(xml, 'name') || 'Unnamed task';
  } else {
    // Checkpoints don't have <name> tags, use type-specific default
    const typeLabel = typeAttr.replace('checkpoint:', '');
    name = `Checkpoint: ${typeLabel}`;
  }

  // Parse based on type
  switch (typeAttr) {
    case 'auto':
      return parseAutoTask(xml, name);
    case 'checkpoint:human-verify':
      return parseHumanVerifyTask(xml, name);
    case 'checkpoint:decision':
      return parseDecisionTask(xml, name);
    case 'checkpoint:human-action':
      return parseHumanActionTask(xml, name);
    default:
      throw new Error(`Unknown task type: ${typeAttr}`);
  }
}

/**
 * Parse complete tasks section to array of Task objects
 *
 * @param xml - Complete tasks section XML (including <tasks> tags)
 * @returns Array of parsed Task objects
 */
export function parseTasksSection(xml: string): Task[] {
  // Extract tasks section content
  const tasksMatch = xml.match(/<tasks[^>]*>([\s\S]*?)<\/tasks>/i);
  if (!tasksMatch) {
    return [];
  }

  const tasksContent = tasksMatch[1];

  // Extract individual tasks
  const taskRegex = /<task\s+type="([^"]+)"[^>]*>([\s\S]*?)<\/task>/gi;
  const tasks: Task[] = [];

  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(tasksContent)) !== null) {
    const taskXml = match[0]; // Full task XML including tags
    try {
      const task = parseTaskXml(taskXml);
      tasks.push(task);
    } catch (error) {
      // Re-throw with more context
      throw new Error(
        `Failed to parse task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return tasks;
}
