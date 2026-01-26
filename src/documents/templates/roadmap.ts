/**
 * ROADMAP.md Generator
 *
 * Generates ROADMAP.md documents following GSD template structure.
 */

import type { RoadmapConfig, PhaseConfig } from '../types.js';

/**
 * Generate ROADMAP.md markdown from config
 */
export function generateRoadmapMd(config: RoadmapConfig): string {
  const hasMilestones = config.milestones && config.milestones.length > 0;

  // Sort phases by numeric order (handles decimal phases like 2.1, 2.2)
  const sortedPhases = [...config.phases].sort((a, b) => {
    return parseFloat(a.number) - parseFloat(b.number);
  });

  return `# Roadmap: ${config.projectName}

## Overview

${config.overview}

${hasMilestones ? generateMilestonesSection(config) : ''}

## Phases

${generatePhasesChecklistSection(sortedPhases)}

## Phase Details

${sortedPhases.map((phase) => generatePhaseDetailSection(phase)).join('\n\n')}

## Progress

${generateProgressSection(sortedPhases)}
`;
}

/**
 * Generate milestones section (for post-v1.0 roadmaps)
 */
function generateMilestonesSection(config: RoadmapConfig): string {
  if (!config.milestones || config.milestones.length === 0) return '';

  return `## Milestones

${config.milestones
  .map((m) => {
    const emoji =
      m.status === 'shipped' ? '✅' : m.status === 'in_progress' ? '🚧' : '📋';
    const shippedInfo = m.shippedDate ? ` (shipped ${m.shippedDate})` : '';
    return `- ${emoji} **${m.version} ${m.name}** - Phases ${m.phases.join(', ')}${shippedInfo}`;
  })
  .join('\n')}
`;
}

/**
 * Generate phases checklist section
 */
function generatePhasesChecklistSection(phases: PhaseConfig[]): string {
  return phases
    .map((phase) => {
      const checkbox = phase.status === 'completed' ? '[x]' : '[ ]';
      const inserted = phase.inserted ? ' (INSERTED)' : '';
      return `- ${checkbox} **Phase ${phase.number}: ${phase.name}**${inserted} - ${phase.goal}`;
    })
    .join('\n');
}

/**
 * Generate phase detail section
 */
function generatePhaseDetailSection(phase: PhaseConfig): string {
  const inserted = phase.inserted ? ' (INSERTED)' : '';
  const dependsOn =
    phase.dependsOn.length === 0
      ? 'Nothing (first phase)'
      : phase.dependsOn.map((d) => `Phase ${d}`).join(', ');

  const requirements =
    phase.requirements && phase.requirements.length > 0
      ? `**Requirements**: ${phase.requirements.join(', ')}\n`
      : '';

  const plansCount = phase.plans.length;
  const plansLabel = plansCount === 1 ? '1 plan' : `${plansCount} plans`;

  return `### Phase ${phase.number}: ${phase.name}${inserted}
**Goal**: ${phase.goal}
**Depends on**: ${dependsOn}
${requirements}**Success Criteria** (what must be TRUE):
${phase.successCriteria.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}
**Plans**: ${plansLabel}

Plans:
${phase.plans
  .map((plan) => {
    const checkbox = plan.completed ? '[x]' : '[ ]';
    return `- ${checkbox} ${plan.id}: ${plan.description}`;
  })
  .join('\n')}`;
}

/**
 * Generate progress table
 */
function generateProgressSection(phases: PhaseConfig[]): string {
  const executionOrder = phases.map((p) => p.number).join(' → ');

  return `**Execution Order:**
Phases execute in numeric order: ${executionOrder}

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
${phases
  .map((phase) => {
    const completed = phase.plans.filter((p) => p.completed).length;
    const total = phase.plans.length;
    const status = phase.status.charAt(0).toUpperCase() + phase.status.slice(1).replace('_', ' ');
    const completedDate = phase.completedDate || '-';

    return `| ${phase.number}. ${phase.name} | ${completed}/${total} | ${status} | ${completedDate} |`;
  })
  .join('\n')}

---
*Roadmap created: ${new Date().toISOString().split('T')[0]}*
*Total: ${phases.length} Phases, ${phases.reduce((sum, p) => sum + p.plans.length, 0)} Plans*
`;
}
