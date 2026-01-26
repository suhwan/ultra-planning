---
phase: {phase_id}
plan: {plan_number}
type: execute
wave: {wave_number}
depends_on: []
files_modified: []
autonomous: true

must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
{what_this_plan_accomplishes}

Purpose: {why_this_matters}
Output: {artifacts_created}
</objective>

<context>
@PROJECT.md
@ROADMAP.md
@STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: {action_oriented_name}</name>
  <files>{file_paths}</files>
  <action>{specific_implementation}</action>
  <verify>{verification_command}</verify>
  <done>{acceptance_criteria}</done>
</task>

</tasks>

<verification>
{overall_checks}
</verification>

<success_criteria>
- [ ] {measurable_criterion}
</success_criteria>

<output>
After completion, create SUMMARY.md
</output>
