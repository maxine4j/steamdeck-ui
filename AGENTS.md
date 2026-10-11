# SteamDeck UI

## Project overview

SteamDeck UI is a controller-first UI replacement for **Retail World of Warcraft**, built for Steam Deck. It is written in TypeScript and compiled to Lua with TypeScriptToLua (TSTL).

WoW API declarations are generated with `yarn setup`, which runs `scripts/generate-declarations.sh`. Regenerate them when the project needs an updated API surface; do not hand-maintain generated declarations.

## Architecture

The architecture has four strict layers:

1. **Component library (hardware layer):** The only layer allowed to call WoW's `CreateFrame` API or otherwise manipulate WoW UI frames directly. It owns frame pooling.
2. **Navigation manager (input layer):** Routes controller D-pad input across the active panels' logical navigation graphs.
3. **Panel system (view layer):** Reusable, domain-agnostic panels and containers composed from component-library controls.
4. **Module system (business layer):** Independent feature domains such as Bags and Paper Doll. Modules own domain logic and request presentation through panels.

Keep these boundaries strict:

- Keep domain logic within its module. Modules must not access the WoW Lua API directly.
- Keep presentation logic in panels. Panels use the component library rather than creating or owning raw WoW frames.
- Put WoW API interactions behind clients. Deliver game events only through the DI-injected event bus; do not call `RegisterEvent` or otherwise subscribe to WoW events from modules or panels.
- Prefer explicit dependency injection throughout. Do not introduce hidden global, event, or frame dependencies.
- Use `FramePoolManager` for presentation components. Acquire pooled frames, reset them on release, and design panels to reuse controls rather than creating frames during normal open/close cycles.

The event bus owns the hidden WoW event frame, translates WoW event payloads into typed application events, and dispatches them to subscribers. This permits modules to be tested with a mock event bus.

Navigation is data-driven: panels expose navigable nodes and their spatial neighbors; the navigation manager owns focus movement and focus styling through the component library. Do not hardcode navigation around incidental frame placement.

## Development workflow

Use Vitest for unit tests. Run `yarn test` for a single run or `yarn test:watch` during development. Keep tests alongside source files as `*.test.ts`; they run in Node and are excluded from the Lua build. Inject mocks for WoW dependencies.

Follow test-driven development: **red, green, refactor**.

1. Write a failing behavioural test.
2. Implement the smallest change that makes it pass.
3. Refactor while keeping the tests green.

Test observable behaviour and architectural seams such as modules, clients, and the event bus. **Never write unit tests for TypeScript types**; rely on the compiler and `yarn typecheck` for type correctness.

Before handing off a change, run the focused tests available for the changed behaviour and `yarn typecheck`. Run `yarn build` when the change affects Lua output or build configuration.
