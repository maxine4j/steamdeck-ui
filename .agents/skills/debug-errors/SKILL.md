---
name: debug-errors
description: Investigate SteamDeckUI playtest JSON exported by yarn debug:extract, group errors by distinct bug, and propose fixes with tradeoffs for user confirmation before implementation.
---

# Debug Errors

Use the user's supplied JSON export, or run `yarn debug:extract` from the repository root. An optional SavedVariables path can follow the command. Read the output as data; never execute the Lua save. WoW only flushes SavedVariables on reload or normal logout, so confirm freshness before drawing conclusions from missing records.

## Investigate

- Inspect `source` and `fileModifiedAt`, then `SteamDeckUIErrors.errors`, `suppressedCount`, and `lastSuppressedAt`. Keep error IDs and timestamps when grouping repeated messages/stacks into likely root causes. Start with the earliest relevant failure; later errors may be consequences.
- Match each error's `environment.buildCommit` against the checkout with `git rev-parse --short=12 HEAD`. Logs also contain `build=...`. History spans builds and sessions: separate them before correlating records. A `-dirty` suffix means the hash identifies a baseline with local edits, not an exact source snapshot. Do not reset or switch the user's checkout to match a report.
- Read each error's `context` first: it preserves preceding log text even after the rolling log evicts it. Then inspect nearby `SteamDeckUILogs.entries` for event names, panel requests/selections, session markers, and scan/performance activity. Timestamps have second precision; preserve array order. A breadcrumb records an attempt, not proof that its handler completed.
- Use `environment.details` to narrow reproduction conditions: zone/map, instance and difficulty, delve tier/progress, group size, class/spec/role, combat state, and game version. Check `unavailableFields`; absent or secret fields are unknown, not false. Older errors may have no context or environment.
- Check `SteamDeckUILogs.droppedCount` and error suppression before claiming the trace is complete. Logs retain at most 10,000 entries/2,000,000 characters; errors retain 100 captured occurrences. A missing log table usually means an older build. No recorded error does not establish that a workflow works.

## Diagnose distinct bugs

Follow the failing stack into the relevant client, component, panel, or module. Lua bundle line numbers belong to the reported build; they may differ from the current `dist/main.lua`. Trace the event/panel path in source and inspect the implicated API call rather than assuming temporal correlation proves causation.

Verify Retail API signatures, availability, multi-return handling, and secret-value restrictions against generated declarations and local Blizzard references. Use the repository's `wow-addon-architect` skill when API research is needed, or `wow-ui-performance` for freezes and scan/frame churn. Keep WoW calls in clients and preserve the repository's layer boundaries.

Group occurrences by their likely underlying bug, not just identical message text. One bug may produce different errors or cascading failures; similar messages may have independent causes. Use stack paths, triggering events, builds and gameplay conditions to justify each group. Keep uncertain relationships explicit rather than forcing every error into a confirmed diagnosis.

## Present proposals, then wait

Present each distinct bug separately with:

- A short bug label, affected workflow, occurrence count and supporting error IDs/builds.
- The likely cause, evidence, confidence and any unresolved questions. Separate primary failures from suspected consequences.
- A recommended fix and why it addresses the cause. Where meaningful alternatives exist, explain their tradeoffs, including scope, compatibility, performance and regression risk. Do not invent options when one clear fix is sufficient.
- Proposed regression coverage and concrete in-game retest conditions. Request a fresh export after reload/logout when more evidence is needed.

End by asking which proposed fixes or investigations the user wants pursued, then stop and wait for confirmation and further instruction. Invoking this skill, including a request to debug or fix the errors, authorizes investigation and proposals only; it does not authorize immediate implementation. Do not edit addon code, add tests, commit changes, or build/install fixes during this investigation phase. Preserve unrelated working-tree and staged changes.

## Route confirmed fixes

In the proposal, state the execution skill based on the number of distinct bugs selected for fixing, not the number of error occurrences or grouped work units:

- **Two or more bugs:** invoke `$swarm` by reading and following `/Users/mings/.codex/skills/swarm/SKILL.md`. Pass the confirmed bug list with stable identifiers, evidence, chosen fixes and acceptance/retest criteria. Let Swarm handle grouping, dependencies, workers, integration and validation; retain its required concrete-plan confirmation before workers start.
- **Exactly one bug:** invoke `$dev-local` by reading and following `/Users/mings/.codex/skills/dev-local/SKILL.md`, with the confirmed bug and chosen fix as its task.
- **No confirmed fixes:** continue only the investigation the user requests; do not start either implementation workflow.

Do not invoke either execution skill before the user confirms the scope and selected fixes. Before seeking confirmation for the Swarm route, disclose its startup behavior: it fetches and resets local `main` to `origin/main`, discarding local-only commits and staged, unstaged and untracked changes. Keep the diagnosed bug list and evidence in the chat so startup cleanup does not erase the task handoff. The investigation phase itself never performs that cleanup.

If the required skill is unavailable, report the blocker rather than silently substituting another workflow. Implement only the confirmed scope and follow the selected skill and `AGENTS.md`, including behavioural regression tests, typecheck and the required build/install. Do not suppress errors or relax capture to make the report appear clean, and do not claim an in-game fix from mocked tests alone.
