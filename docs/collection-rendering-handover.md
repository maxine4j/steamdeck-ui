# Collection rendering handover

## Required behavior

The user validated the toy collection approach and requested the same behavior
for mounts, pets, and now appearances:

- Create and render only tiles near the viewport, plus one full viewport ahead.
- Keep prepared tiles and their native frames. Scrolling up or back down through
  prepared rows must schedule **no render callback**, rebuild no navigation, and
  perform no tile layout or property writes.
- Prepare additional rows only when the viewport reaches an unprepared area.
  Data changes can refresh presentation independently of scrolling.
- Preserve controller navigation, mouse interactions, tooltips, filters, counts,
  and feature-specific actions.

## Rules that prevent regressions

1. Keep full logical content height and stable tile coordinates even when most
   tiles have no frames. Native scrollbar range must describe the entire list.
2. Use `Frame.getVisibleVerticalRange()` and `Frame.onVerticalScroll()`; native
   frame APIs stay in generic components. Read `AGENTS.md` and the
   `.agents/skills/wow-ui-performance/SKILL.md` instructions before changing code.
3. Use `PreparedRanges` to remember completed presentation coverage. Record a
   range only after its batched frame work completes. Merge adjoining coverage,
   but never mark a skipped gap or cancelled batch as prepared.
4. Current render bounds are `top - 2 * spacing` through
   `bottom + Math.max(2 * spacing, bottom - top)`. The extra viewport below gives
   page lookahead; the small upper buffer supports jumps into unvisited areas.
   Test viewport coverage against completed bounds, not exact scroll offsets.
5. Coalesce scroll callbacks through the injected scheduler. Recheck coverage
   when a scheduled callback runs: the user may have returned to prepared rows.
   Let an active render finish rather than repeatedly cancelling it during
   scrolling, then check the latest viewport for more work.
6. Retain controls by stable identity. Preserve visited navigation nodes during
   manual scrolling. Removing the focused off-screen node makes navigation pick
   and reveal another node, pulling the viewport away from the user's position.
   Navigation must still reveal deferred rows during controller movement.
7. **Do not re-anchor the scroll child on each scroll render.** Repeated
   `content.layout(..., "TOPLEFT", viewport)` caused visible content to return to
   the top while `GetVerticalScroll()` and the scrollbar retained their offsets.
   The current panels guard layout with `laidOutHeight`; resize still clamps the
   viewport and checks whether additional rows need preparation.
8. Cache grouping/sorting for the current data projection. Scrolling must not
   regroup the entire collection. Reset grouping and prepared coverage when
   replacement data, filtering, favourites, or ordering makes them obsolete.
9. Keep game-data cache warming separate from presentation. Closing cancels
   pending presentation and detaches listeners; it must not stop client-owned
   background collection scans. Reopening must reconcile interrupted UI work.
10. Guard stale actions with current identity/data and mounted state. Preserve
    existing combat restrictions. Deferred execution cannot bypass lockdown.
11. Log actual tile updates separately from ready/reused tiles. The old
    `tiles=137` message counted reused tiles and misleadingly suggested that
    every scroll rewrote them. Node tests do not establish in-game performance.

## Implementation locations

| Purpose | Location |
| --- | --- |
| Completed range tracking shared by all three panels | `src/ui/prepared-ranges.ts` |
| Most complete reference: scheduling, lookahead, coverage invalidation, retained navigation, layout guard | `src/modules/toys/toys-panel.ts` |
| Tests for revisiting ranges, page lookahead, skipped gaps, resize, combat, focus, cooldowns | `src/modules/toys/toys-panel.test.ts` |
| Mount migration, including favourites and stable mount frames | `src/modules/mounts/mounts-panel.ts` |
| Mount migration regressions | `src/modules/mounts/mounts-panel.test.ts` |
| Pet migration, including species-based tiles and duplicate counts | `src/modules/pets/pets-panel.ts` |
| Pet migration regressions | `src/modules/pets/pets-panel.test.ts` |
| Generic native viewport operations | `src/ui/components/frame.ts` |
| Generic viewport tests | `src/ui/components/frame-scroll-pan.test.ts` |
| Appearance implementation to optimize next | `src/modules/appearances/appearances-panel.ts` |
| Existing appearance behavior tests | `src/modules/appearances/appearances-panel.test.ts` |

Search the panel references for `requestViewportRender`, `isViewportPrepared`,
`preparedRanges`, `firstVisible`, `lastVisible`, and `laidOutHeight`.

## Appearance-specific requirements

- Appearance content is retained per equipment slot in `SlotView`. Keep prepared
  coverage, grouping, and layout bookkeeping associated with the correct slot;
  one slot's prepared ranges cannot stand in for another slot's content.
- Preserve slot selection/back navigation, expansion grouping, retained try-ons,
  and the clear/current appearance controls and model preview.
- Cancel stale scheduled presentation when changing slot, going back, closing,
  or receiving a replacement projection. A callback must not update another
  slot's scroll child or mark that slot's range prepared.
- Keep appearance-specific logic inside its module. Reuse `PreparedRanges` and
  generic component APIs; do not copy WoW calls into the panel.

## Workflow and verification

Use strict red/green/refactor with behavioural tests and `apply_patch` edits.
Cover bounded initial work, one-page lookahead, no callbacks or writes while
revisiting prepared rows, scrolling into new rows, jumps over unvisited gaps,
stable focus, resizing, data replacement, cancellation, and slot isolation.
Use a controllable scheduler and call counts rather than timing assertions.

Run focused tests, lint for changed files, `yarn typecheck`, and `yarn build`.
Report build blockers explicitly and do not claim in-game verification.

At handover, mounts/pets migrations and the shared range helper are uncommitted
in the existing checkout. They belong to the preceding task: use them, preserve
them, and exclude them from an appearance-only commit. The last mount/pet check
passed 93 focused tests, lint, and typecheck; its build was blocked by concurrent
debug tooling in `src/clients/debug-client.ts`. That external state may already
have changed: inspect the working tree and rerun checks rather than assuming it
is still blocked. Do not revert, stage, or commit unrelated changes.
