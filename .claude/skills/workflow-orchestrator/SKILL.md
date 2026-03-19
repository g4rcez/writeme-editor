---
name: workflow-orchestration
description: >
  Workflow orchestration for Claude Code sessions — plan-first execution, subagent delegation,
  self-improvement loops, and structured task tracking. Activates automatically on any non-trivial
  task: feature implementation, bug fixes, refactors, migrations, or multi-step work. Also triggers
  when the user mentions: "new feature", "implement", "build", "fix this bug", "refactor", "migrate",
  "plan this", "let's start", "new task", "create a spec", or shares a codebase and asks to build
  something. If the task takes more than a handful of edits to complete, this skill applies. Think
  of it as the operating system for how work gets done — every other skill runs inside this workflow.
  Even if the user jumps straight into coding, pause and activate plan mode first.
---
 
# Workflow Orchestration
 
This skill defines how Claude Code approaches any non-trivial work. It's the process layer that wraps around every other skill — when you build a feature, fix a bug, or refactor code, this is the rhythm you follow.
 
The core philosophy: **simplicity is power.** Every decision — architectural, procedural, tooling — should trend toward the simplest solution that works. If a fix feels like a hack, step back and find the elegant path. Just change what is necessary; avoid introducing bugs by touching unrelated things.
 
---
 
## Phase 1: Plan Mode (Always Start Here)
 
Plan mode is the default for any task that isn't a one-liner. Before writing a single line of code, think through what needs to happen. This upfront investment prevents the costly rework that comes from diving in blind.
 
### When to Activate Plan Mode
 
- Any feature implementation
- Bug fixes (especially ones that aren't immediately obvious)
- Refactors or migrations
- Multi-file changes
- Anything where the wrong approach wastes more time than planning saves
 
### What Plan Mode Produces
 
1. **Spec document** — Write a detailed spec at `docs/specs/FEATURE_NAME.md` covering:
   - Problem statement (what and why)
   - Proposed solution (how, with enough detail to reduce ambiguity)
   - Edge cases and constraints
   - Definition of done (concrete, verifiable criteria)
 
2. **Task entry** — Add an entry to `docs/TASKS.md` with the feature name and status. This is the central index of all work.
 
3. **Task breakdown** — Inside the spec, list the discrete steps needed. Each step should be small enough to verify independently.
 
### Planning Discipline
 
- If something sounds weird or goes sideways during implementation, **stop and rethink the plan.** Don't push through a bad approach hoping it works out.
- Use plan mode for verification steps too, not just building. Before running tests or checking results, think about what you expect to see.
- Write detailed specs upfront. Ambiguity in the plan becomes bugs in the code.
- Review the plan after writing it — ask yourself: "Is there a simpler way?"
 
### Spec Template
 
```markdown
# Feature: [NAME]
 
## Problem
What's broken or missing, and why it matters.
 
## Solution
How we'll solve it. Be specific enough that implementation is mechanical.
 
## Edge Cases
What could go wrong. What inputs are weird. What states are unexpected.
 
## Task Breakdown
- [ ] Step 1: ...
- [ ] Step 2: ...
- [ ] Step 3: ...
 
## Definition of Done
- [ ] Tests written and passing
- [ ] Correctness demonstrated (logs, screenshots, manual verification)
- [ ] A staff engineer would approve this
- [ ] Documentation updated
```
 
---
 
## Phase 2: Execution
 
### Subagent Delegation
 
Use subagents to keep the main context window clean and focused. The main thread is for orchestration; heavy lifting happens in subagents.
 
**When to use subagents:**
- Research and exploration (reading docs, scanning codebases, understanding patterns)
- Parallel analysis (reviewing multiple files or modules at once)
- Complex problems that benefit from more compute — throw subagents at it
- Any self-contained unit of work that doesn't need constant back-and-forth
 
**Rules:**
- One task per subagent. Keep the scope focused so results are clean.
- Give subagents clear, specific instructions — include file paths, expected output format, and constraints.
- After finishing a task, suggest subagent instructions the user could spawn for follow-up work.
 
### Bug Fixes: Root Cause First
 
For bug corrections, the process is different from feature work. Don't patch the symptom — find the root cause.
 
1. **Reproduce** — Confirm the bug exists and understand the exact failure
2. **Trace** — Follow the data flow to find where things go wrong
3. **Root cause** — Identify the actual source, not just where it surfaces
4. **Fix** — Change the minimum necessary. Avoid temporary workarounds.
5. **Verify** — Prove the fix works and doesn't break anything else
 
If a fix feels like a hack: stop. Based on everything you know now, implement the elegant solution instead.
 
### Simplicity Checklist
 
Before implementing anything, ask:
- Is there a simpler way to do this?
- Am I changing only what's necessary?
- Will this change surprise a future reader?
- Would a staff engineer look at this and say "that's clean"?
 
---
 
## Phase 3: Self-Improvement Loop
 
This is what separates good sessions from great ones. Learn from mistakes in real time.
 
### LESSONS.md
 
The `LESSONS.md` file at the project root is a living document of patterns learned through corrections. It prevents the same mistake from happening twice.
 
**At session start:**
- Read `LESSONS.md` if it exists. Internalize the patterns relevant to the current project and task.
 
**After any correction from the user:**
1. Identify the pattern — what went wrong and why
2. Write a rule that prevents the same mistake: specific, actionable, and framed as guidance (not just "don't do X" but "do Y instead because Z")
3. Add it to `LESSONS.md`
4. If the pattern is general enough, save it to Claude rules so it persists across sessions
 
**Iteration discipline:**
- After adding a lesson, review the plan in light of the new knowledge
- Iterate until the mistake rate drops
- If you notice yourself making the same class of error repeatedly, that's a signal to add a broader rule
 
### LESSONS.md Format
 
```markdown
# Lessons
 
## [Category: e.g., API Design, React Patterns, Testing]
 
### [Short description of the pattern]
- **Trigger**: What situation causes this mistake
- **Rule**: What to do instead
- **Why**: The reasoning behind the rule
- **Learned from**: Brief context on when this came up
```
 
---
 
## Phase 4: Definition of Done
 
A task is not complete until all of these are true. No exceptions.
 
1. **Tests exist and pass** — Never complete a task without writing tests or proving it works through demonstration. This means unit tests, integration tests, or at minimum a documented manual verification.
 
2. **Staff-engineer bar** — Ask yourself: "Would a staff engineer approve this?" If the answer is "maybe" or "with caveats," it's not done.
 
3. **Correctness demonstrated** — Run the tests, check the logs, and demonstrate that the code does what it's supposed to. Don't assume it works — prove it.
 
4. **Documentation written** — Create `docs/tasks/FEATURE_NAME.md` describing the implemented feature: what was built, key decisions, and anything a future developer needs to know.
 
5. **Spec updated** — Go back to `docs/specs/FEATURE_NAME.md` and fill in the definition of done checkboxes.
 
6. **TASKS.md updated** — Mark the task as complete in the central task index.
 
---
 
## Phase 5: Review
 
After implementation, before calling it done, run a review pass.
 
### Self-Review Questions
 
1. **Elegance** — Is there a more elegant way to do this? If yes, and the effort is reasonable, do it now.
2. **Simplicity** — Can anything be removed without losing functionality? Simpler is better.
3. **Hack check** — Does any part of this feel like a workaround? If so: "Based on everything I know now, I will implement the elegant solution."
4. **Lessons check** — Consult `LESSONS.md`. Are any known patterns being violated?
5. **Scope check** — Did you only change what was necessary? Unnecessary changes introduce unnecessary risk.
 
---
 
## Task Management
 
All task tracking lives in the `docs/` directory. This is the source of truth for what's planned, in progress, and done.
 
### File Structure
 
```
docs/
├── TASKS.md                    # Central index of all features/tasks
├── specs/
│   └── FEATURE_NAME.md         # Spec + discussion + definition of done
└── tasks/
    └── FEATURE_NAME.md         # Post-implementation documentation
```
 
### TASKS.md Format
 
```markdown
# Tasks
 
## In Progress
- [ ] Feature name — Brief description
 
## Completed
- [x] Feature name — Brief description
```
 
### Workflow Summary
 
1. New task arrives → Add entry to `TASKS.md`
2. Plan mode → Create `docs/specs/FEATURE_NAME.md` with spec, task breakdown, and definition of done
3. Execute → Work through the task breakdown, checking off steps
4. Complete → Create `docs/tasks/FEATURE_NAME.md` with implementation details
5. Update → Mark the feature as done in both `TASKS.md` and the spec's definition of done
 
### Mark Progress as You Go
 
Don't wait until the end. As each step in the task breakdown completes:
- Check it off in the spec
- Update `TASKS.md` if the overall status changes
- Note any deviations from the plan (and why)
 
---
 
## Quick Reference: The Full Loop
 
```
1. PLAN    → Read LESSONS.md → Write spec → Break into tasks → Update TASKS.md
2. EXECUTE → Use subagents → Keep changes minimal → Root-cause bugs
3. LEARN   → User corrects → Update LESSONS.md → Adjust plan
4. VERIFY  → Tests pass → Staff-engineer bar → Demonstrate correctness
5. REVIEW  → Elegance check → Simplicity check → Lessons check
6. CLOSE   → Write docs/tasks/FEATURE_NAME.md → Update TASKS.md → Update spec DoD
```
