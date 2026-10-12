---
name: wow-ui-performance
description: Diagnose and optimize Retail WoW addon UI freezes, slow panel opening, repeated journal or inventory scans, frame churn, and expensive controller navigation in this TypeScriptToLua repository.
---

# WoW UI Performance

Optimize the complete path from input or a game event to data lookup, rendering, and navigation. Cached data does not make opening cheap if another layer still rebuilds thousands of controls or navigation edges.

## Diagnose the complete opening path

- Trace visibility hooks, module event handlers, client calls, panel mount/refresh methods, component rendering, and navigation registration. Count work during first opening and reopening.
- Look for duplicate work: mounting retained rows and immediately replacing them, fetching on both visibility and mount, event bursts refreshing the same snapshot, or resizing a viewport rebuilding all its content.
- Check algorithmic cost before changing scheduling. The original navigation graph compared every control against every other control for all four directions: O(N²) on every opening, even with cached mount data. Fixing the shared graph benefits every panel.
- Establish improvements through lookup, frame creation, and render counts. Use in-game profiling when available; passing Node tests and compiling Lua do not establish that a client freeze is gone.

## Spread work across frames

WoW Lua and native API calls execute synchronously on the UI thread. Timer callbacks defer execution; they do not create worker threads or make individual native lookups asynchronous. Deferring an entire expensive loop merely moves the hitch.

- Use the injected `ITaskScheduler.nextFrame` service, implemented with `C_Timer.After(0)`, to continue bounded work on a later frame.
- Batch both data collection and native frame updates. Deferred enumeration can still end in a freeze if rendering creates every row at once.
- Mount loading currently uses 20 lookup operations per callback; list and bag rendering use batches of 10. These are starting points, not universal guarantees. Tune against operation costs and hardware; consider a measured time budget when costs vary.
- Budget cleanup too: shrinking a list may require hiding hundreds of retained controls.
- Cancel pending callbacks on unmount, shutdown, or replacement of a load. Cancellation must cover the latest continuation, not just the initial callback. Prevent stale results from publishing; use a generation check when cancellation alone is insufficient.
- Prevent interactions with controls representing old data. Preserve focus identity during replacement and publish navigation changes when controls are ready.

## Cache through lifecycle and events

- Load on first use, then invalidate from relevant application events and local actions. Reopening unchanged content should reuse data, controls, and logical navigation nodes.
- While hidden, record invalidation without scanning or rendering. Collapse hidden events into one refresh on the next opening.
- Coalesce visible event bursts into one scheduled refresh. Item-data completion events can otherwise cause a full inventory or equipment scan for every loaded item.
- Track independent domains separately: equipment, stats, and model preview need not all refresh for a stats event.
- Keep dirty state until work completes successfully. Cancelled partial rendering must finish or rebuild on reopening rather than being treated as complete.
- Inspect events firing on opening. A cache invalidated on every visibility-related event may still perform the full scan on every reopen.
- Read stable collection sizes once outside loops. Avoid repeating `GetNumDisplayedMounts`, `GetNumTitles`, or `GetNumFactions` in loop conditions.

## Reuse presentation and keep navigation cheap

- Retain pooled controls across normal open/close cycles. Pooling avoids allocation churn but not repeated native property writes.
- Separate layout from data invalidation. Bag viewport resizing needs recentering and scroll clamping, not regrouping inventory or reinstalling item handlers.
- Skip unchanged label text and layout writes. Clear caches when releasing pooled frames so later reuse receives the required initial state.
- Keep navigation graph construction linear in the number of controls. Resolve neighbors on demand and cache hits and misses. Preserve directional and alignment rules; invalidate neighbor caches when the logical grid changes.
- Consider viewport virtualization for very large lists. Account for off-screen controller focus, variable row heights, secondary actions, and stable focus identity.
- Respect combat restrictions when deferred work reaches secure controls. Scheduling cannot bypass lockdown; retain component guards and secure input behavior.

## Repository patterns to inspect

Read current implementations before extending them; these paths identify patterns rather than frozen contracts:

- `src/clients/task-scheduler.ts`: cancellable next-frame scheduling.
- `src/clients/mounts-client.ts`: bounded journal enumeration and collection counting.
- `src/ui/deferred-refresh.ts`: visible refresh coalescing and hidden invalidation.
- `src/ui/components/scroll-list.ts`: retained rows, batched rendering and cleanup, interaction readiness, and navigation notifications.
- `src/ui/navigation/navigation-grid.ts`: lazy neighbor lookup with cached hits and misses.
- `src/modules/bags/bags-module.ts` and `bags-panel.ts`: event-driven caching, batched presentation, and resize-only layout.
- `src/modules/paper-doll/`: separate equipment, stats, and preview invalidation.
- `src/ui/components/frame.ts`: avoiding unchanged label writes and resetting caches on release.

Preserve the architecture in `AGENTS.md`: modules own domain logic, clients own WoW calls, generic components own native presentation, and game events arrive through the injected event bus. Verify unfamiliar API behavior against local Blizzard source and declarations. Regenerate declarations for new API surface; do not hand-edit generated files.

## Verify behavior and work reduction

Follow red/green/refactor. Cover first load, unchanged reopening, hidden invalidation, visible event bursts, partial-load cancellation, shrinking lists, resize, and focus/action correctness as relevant. Advance a controllable scheduler queue one callback at a time to prove work is bounded; avoid fragile wall-clock thresholds.

Run focused tests, `yarn typecheck`, and `yarn build` before handoff. Report removed costs, remaining synchronous work, and whether in-game performance has actually been verified.
