# MCP tools

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

One page per tool the mnema MCP server serves, with the description, the parameters and the
annotations an agent host is handed.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## Read only

- [bootstrap](mcp/bootstrap.md): Bootstrap the session
- [focus](mcp/focus.md): Focus: what I am touching now
- [resume](mcp/resume.md): Resume: where I left off
- [next_actions](mcp/next-actions.md): Next actions: what moves a task allows
- [guard](mcp/guard.md): Guard: would a move be allowed?
- [search](mcp/search.md): Search: find what has been recorded
- [read_record](mcp/read-record.md): Read record: one whole record by id
- [audit_timeline](mcp/audit-timeline.md): Audit: the full history of an entity
- [audit_refs](mcp/audit-refs.md): Audit: what an entity is connected to
- [governing_rules](mcp/governing-rules.md): Which recorded rules govern this path
- [audit_accountability](mcp/audit-accountability.md): Audit: who authorized what
- [audit_exposure](mcp/audit-exposure.md): Audit: where a credential may already be recorded
- [audit_antipatterns](mcp/audit-antipatterns.md): Audit: recurring shapes in the record

## May write to the record

- [capture_memory](mcp/capture-memory.md): Capture a memory
- [record_observation](mcp/record-observation.md): Record an observation
- [retract_note](mcp/retract-note.md): Retract a note
- [retract_link](mcp/retract-link.md): Retract a link
- [record_handoff](mcp/record-handoff.md): Record a handoff
- [link_knowledge](mcp/link-knowledge.md): Link knowledge
- [create_task](mcp/create-task.md): Create a task
- [task_transition](mcp/task-transition.md): Move a task through the workflow
- [record_decision](mcp/record-decision.md): Record a decision
- [decision_transition](mcp/decision-transition.md): Move a decision through the workflow
- [create_skill](mcp/create-skill.md): Propose a skill
- [skill_transition](mcp/skill-transition.md): Move a skill through the workflow
- [skills](mcp/skills.md): Skills: the patterns to work by, and the ones awaiting a ruling
- [rules_before_an_edit](mcp/rules-before-an-edit.md): The rules of the record for a file about to change
