# SteamDeck UI

Controller-first UI for Retail World of Warcraft, written in TypeScript and compiled to Lua.

Run `yarn build`, then copy the contents of `dist/` into an `Interface/AddOns/SteamDeckUI/` directory. Log in or reload the UI. The proof of concept displays a solid black 420 × 560 panel at the left edge of the screen.

Startup injects the native frame factory, event bus, frame pool, panel orchestrator, and module manager. `PLAYER_LOGIN` starts the modules once. The placeholder Bags module only requests the test panel; it has no inventory behavior. Frames and background textures are pooled, and closing/reopening a panel reuses its controls.

Controller navigation remains a future step: the test panel has no interactive controls.

Use `yarn test`, `yarn typecheck`, and `yarn build` to verify changes. Generate game API declarations with `yarn setup`.
