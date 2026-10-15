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
- On panel unmount, cancel presentation work and detach cache listeners; collection scans continue warming SavedVariables while hidden. Cancel scans on client shutdown and superseded presentation or filter work on replacement. Cancellation must cover the latest continuation, not just the initial callback. Use generation checks to prevent cancelled work from publishing.
- Prevent interactions with controls representing old data. Preserve focus identity during replacement and publish navigation changes when controls are ready.

## Collection caching through lifecycle and server events

Apply these rules to mounts first and preserve generic caching logic for future toy, pet, and achievement migrations:

- Store collection data in SavedVariables. WoW loads that table into memory; use it as the single authoritative cache layer. Remove separate memory caches, duplicate persisted snapshots, and tiered or multilayer cache logic.
- The cache has no TTL, expiry, or entry invalidation. Server events update retained entries directly; they do not mark them stale for a later panel opening.
- Opening the mounts panel immediately renders cached entries. Opening or reopening starts a full journal scan only when the cache is empty; a populated cache never causes an opening-driven scan. Share an existing scan rather than starting another.
- Login always starts a full journal scan, even when the saved cache is populated, to warm it for the session. Login and context-free server events are explicit exceptions to the empty-cache-only opening rule.
- After login, update collection data solely in response to server events. When an event identifies a specific mount, update that entry using the event payload or a targeted lookup; do not scan the full journal.
- When a server event provides no useful item context, start a full journal scan in the background, including while the panel is hidden. Keep the cache ready before the next opening rather than deferring refreshes until then.
- Run background scans in bounded, paginated batches across frames so they do not hitch the game. Persist each page into the same SavedVariables store and notify listeners as results arrive; never hold all results until the entire scan finishes.
- While open, the mounts panel subscribes to cache updates and updates the relevant controls and counts as each page or entry changes. Closing detaches UI listeners without stopping cache warming; reopening reads the latest cache and resubscribes.
- Acquire mount controls through the component library and frame pool once, retain their native WoW frames for the session, and update controls by stable mount identity. Never release mount frames back to the pool, including on panel shutdown; hide them instead.
- Keep persistence, subscriptions, and batched cache writes generic. Clients own journal API calls and server-payload conversion; modules route typed events through injected clients, and panels compose generic components. Do not move mount-specific behaviour into the shared cache, component library, navigation manager, or panel host.

Coalesce event bursts without losing updates that arrive behind an active scan's cursor. Search and filter changes update the displayed projection using cached details and bounded ID lookups, rather than triggering a full detail scan. Read stable collection sizes once outside loops.

For inventory and character panels, track independent equipment, stats, and model-preview changes separately and coalesce item-data event bursts. Their existing refresh helpers must not override the collection caching rules above.

## Reuse presentation and keep navigation cheap

- Retain controls across normal open/close cycles. Mount frames remain acquired for the entire session and keep their entry identities across filtering and favourite changes. Pooling avoids allocation churn but not repeated native property writes.
- Separate layout changes from data updates. Bag viewport resizing needs recentering and scroll clamping, not regrouping inventory or reinstalling item handlers.
- Skip unchanged label text, icons, and layout writes; update changed entries and affected group headers or positions. Generic components that release frames must reset remembered native property values for later reuse; mount controls never release their frames.
- If partial rendering is cancelled, finish or reconcile presentation from the current cache on reopening. Never discard completed cache pages or use a presentation cancellation to invalidate collection entries.
- Keep navigation graph construction linear in the number of controls. Resolve neighbors on demand and cache hits and misses. Preserve directional and alignment rules; invalidate neighbor caches when the logical grid changes.
- Consider viewport virtualization for very large lists where appropriate. Mount controls must retain their frames and stable entry identities; do not recycle them between mounts or return them to the pool. Account for off-screen controller focus, variable row heights, and secondary actions.
- Respect combat restrictions when deferred work reaches secure controls. Scheduling cannot bypass lockdown; retain component guards and secure input behavior.

## Repository patterns to inspect

Read current implementations before extending them; these paths identify patterns rather than frozen contracts:

- `src/clients/task-scheduler.ts`: cancellable next-frame scheduling.
- `src/clients/collection-cache.ts` and `saved-variable-cache.ts`: lazy SavedVariables access, shared namespace subscriptions, and generic batched writes without TTLs or a second data store.
- `src/clients/mounts-client.ts`: bounded journal scans, targeted event updates, incremental persistence, cached counts, and displayed-ID projections.
- `src/modules/mounts/mounts-module.ts` and `mounts-panel.ts`: server-event routing, live cache subscriptions, retained mount controls, and incremental presentation.
- `src/ui/deferred-refresh.ts`: inventory and character-panel refresh coalescing; its hidden-refresh behaviour does not apply to collection scans.
- `src/ui/components/scroll-list.ts`: retained rows, batched rendering and cleanup, interaction readiness, and navigation notifications.
- `src/ui/navigation/navigation-grid.ts`: lazy neighbor lookup with cached hits and misses.
- `src/modules/bags/bags-module.ts` and `bags-panel.ts`: event-driven caching, batched presentation, and resize-only layout.
- `src/modules/paper-doll/`: independent equipment, stats, and preview refreshes.
- `src/ui/components/frame.ts`: avoiding unchanged label writes and resetting caches on release.

Preserve the architecture in `AGENTS.md`: modules own domain logic, clients own WoW calls, generic components own native presentation, and game events arrive through the injected event bus. Verify unfamiliar API behavior against local Blizzard source and declarations. Regenerate declarations for new API surface; do not hand-edit generated files.

## Verify behavior and work reduction

Follow red/green/refactor. For collections, cover synchronous warm-cache opening without scans, a shared empty-cache scan, unconditional login warming, targeted ID events, context-free background scans while hidden, incremental saved page writes and notifications, event bursts during scans, listener detachment on close, continued hidden warming, cancellation on shutdown, and stable retained frames that update only changed entries. Verify filtered reopening, favourite changes, counts, and stale-action prevention during batched hiding. For other panels, cover shrinking lists, resize, and focus/action correctness as relevant. Advance a controllable scheduler queue one callback at a time to prove work is bounded; avoid fragile wall-clock thresholds.

Run focused tests, `yarn typecheck`, and `yarn build` before handoff. Report removed costs, remaining synchronous work, and whether in-game performance has actually been verified.
