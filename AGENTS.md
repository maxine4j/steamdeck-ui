# SteamDeck UI

## Project overview

SteamDeck UI is a controller-first UI replacement for **Retail World of Warcraft**, built for Steam Deck. It is written in TypeScript and compiled to Lua with TypeScriptToLua (TSTL).

WoW API declarations are generated with `yarn setup`, which runs `scripts/generate-declarations.sh`. Regenerate them when the project needs an updated API surface; do not hand-maintain generated declarations.

## Architecture

The architecture has four strict layers:

1. **Component library:** Generic UI primitives such as frames, buttons, selects, modals, dropdowns, and text boxes. The only layer allowed to call WoW's `CreateFrame` API or manipulate native UI frames directly. It owns frame pooling and generic frame operations; it must contain no feature-specific behavior.
2. **Navigation manager (input layer):** Routes controller D-pad input across the active panels' logical navigation graphs.
3. **Panel system (container layer):** Low-level panel lifecycle, frame reuse and optimization, and left/right/fullscreen docked containers. It does not implement the content displayed inside panels.
4. **Module system (feature layer):** Independent feature domains such as Bags and Paper Doll. Each module owns its business logic, concrete panel content, layout, and integration with the built-in UI it replaces.

Keep these boundaries strict:

- Keep domain logic within its module. Modules must not access the WoW Lua API directly.
- Keep feature-specific presentation inside its module directory. For example, `BagsPanel` and built-in bag replacement belong in `src/modules/bags/`, never in `src/ui/panel/` or `src/ui/components/`.
- Module-owned panels implement the shared panel interface and compose generic components; native frame creation and manipulation stay behind generic component APIs. The shared panel system only hosts their content and manages lifecycle and docking.
- Module lifecycle includes `disableBuiltIn()` before initialization. Feature-specific clients/adapters own Blizzard integration and binding hooks, publish input through the injected event bus, and restore built-in UI on shutdown. Modules subscribe to those events without calling WoW APIs themselves.
- Put WoW API interactions behind clients. Deliver game events only through the DI-injected event bus; do not call `RegisterEvent` or otherwise subscribe to WoW events from modules or panels.
- Clients own direct WoW API calls, API-specific constants, and conversion into application data. Do not inject low-level WoW API adapters into clients or put those details in `main.ts`; the entry point only constructs and wires dependencies. Inject client interfaces into modules, and mock WoW globals when testing clients.
- Prefer explicit dependency injection throughout. Do not introduce hidden global, event, or frame dependencies.
- Use `FramePoolManager` for presentation components. Acquire pooled frames, reset them on release, and design panels to reuse controls rather than creating frames during normal open/close cycles.
- Preserve the shared window styling, including the metal window border. Native feature content can retain its background artwork, but host it inside the shared window skin and remove redundant Blizzard window chrome. Fit the focus outline to the styled window, not an oversized fullscreen container.

The event bus owns the hidden WoW event frame, translates WoW event payloads into typed application events, and dispatches them to subscribers. This permits modules to be tested with a mock event bus.

Navigation is data-driven: panels expose navigable nodes and their spatial neighbors; the navigation manager owns focus movement and focus styling through the component library. Do not hardcode navigation around incidental frame placement.

## Development workflow

Use Vitest for unit tests. Run `yarn test` for a single run or `yarn test:watch` during development. Keep tests alongside source files as `*.test.ts`; they run in Node and are excluded from the Lua build. Inject mocks for WoW dependencies.

Follow test-driven development: **red, green, refactor**.

1. Write a failing behavioural test.
2. Implement the smallest change that makes it pass.
3. Refactor while keeping the tests green.

Test observable behaviour and architectural seams such as modules, clients, and the event bus. **Never write unit tests for TypeScript types**; rely on the compiler and `yarn typecheck` for type correctness.

Before handing off a change, run the focused tests available for the changed behaviour and `yarn typecheck`. Always run `yarn build` after making changes for the user so the addon is built and ready for them to test. If the build fails, report the blocker explicitly.

## Code reference

Error capture references: `.libraries/BugGrabber-source` (official CurseForge Subversion source downloaded over HTTPS), `.libraries/bug-grabber` (GitHub mirror tooling), and `.libraries/BugSack` (display source). `yarn setup` obtains these references. Do not embed either addon.

You can find a few reference AddOns developed by other people under the .libraries directory, including ConsolePort, BetterBags, and the full official blizzard ui under wow-ui-source. Please use these as reference while working but remember we're writing TypeScript code and they are in lua.
