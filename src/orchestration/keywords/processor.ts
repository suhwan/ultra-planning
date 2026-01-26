import type { MagicKeyword, KeywordConfig, KeywordDetectionResult } from './types.js';
import { BUILTIN_KEYWORDS } from './patterns.js';

/**
 * Pattern for fenced code blocks (```...```)
 */
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;

/**
 * Pattern for inline code (`...`)
 */
const INLINE_CODE_PATTERN = /`[^`]+`/g;

/**
 * Remove code blocks from text for keyword detection
 * This prevents false positives when keywords appear in code examples
 */
export function removeCodeBlocks(text: string): string {
  return text
    .replace(CODE_BLOCK_PATTERN, '')
    .replace(INLINE_CODE_PATTERN, '');
}

/**
 * Detect magic keywords in a prompt
 *
 * @param prompt - The prompt text to scan
 * @param config - Optional configuration for custom keywords
 * @returns Detection result with found keywords and metadata
 */
export function detectKeywords(
  prompt: string,
  config?: KeywordConfig
): KeywordDetectionResult {
  const cleanedPrompt = removeCodeBlocks(prompt);
  const detected: string[] = [];

  // Build keyword list: built-in + custom
  const keywords: MagicKeyword[] = [...BUILTIN_KEYWORDS];
  if (config?.custom) {
    keywords.push(...config.custom);
  }

  // Apply overrides to built-in keywords
  if (config?.overrides) {
    for (const keyword of keywords) {
      for (const trigger of keyword.triggers) {
        if (config.overrides[trigger]) {
          keyword.triggers = config.overrides[trigger];
        }
      }
    }
  }

  // Scan for keyword triggers
  for (const keyword of keywords) {
    for (const trigger of keyword.triggers) {
      const regex = new RegExp(`\\b${escapeRegex(trigger)}\\b`, 'i');
      if (regex.test(cleanedPrompt)) {
        detected.push(trigger);
        break; // Only add each keyword once
      }
    }
  }

  return {
    detected,
    originalPrompt: prompt,
    cleanedPrompt,
    hasKeywords: detected.length > 0
  };
}

/**
 * Create a keyword processor function
 *
 * @param config - Optional configuration for custom keywords
 * @returns A function that enhances prompts with keyword actions
 */
export function createKeywordProcessor(
  config?: KeywordConfig
): (prompt: string) => string {
  // Build keyword list: built-in + custom
  const keywords: MagicKeyword[] = [...BUILTIN_KEYWORDS];
  if (config?.custom) {
    keywords.push(...config.custom);
  }

  // Apply overrides to built-in keywords
  if (config?.overrides) {
    for (const keyword of keywords) {
      for (const trigger of keyword.triggers) {
        if (config.overrides[trigger]) {
          keyword.triggers = config.overrides[trigger];
        }
      }
    }
  }

  return (prompt: string): string => {
    let result = prompt;
    const cleanedPrompt = removeCodeBlocks(prompt);

    // Check each keyword
    for (const keyword of keywords) {
      const hasKeyword = keyword.triggers.some(trigger => {
        const regex = new RegExp(`\\b${escapeRegex(trigger)}\\b`, 'i');
        return regex.test(cleanedPrompt);
      });

      if (hasKeyword) {
        result = keyword.action(result);
      }
    }

    return result;
  };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
