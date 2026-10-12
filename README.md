# SteamDeck UI

Controller-first UI for Retail World of Warcraft, written in TypeScript and compiled to Lua.

Run `yarn build`, then copy the contents of `dist/` into an `Interface/AddOns/SteamDeckUI/` directory. Log in or reload the UI.

Startup injects the native frame factory, event bus, frame pool, panel orchestrator, clients, and module manager. `PLAYER_LOGIN` starts the modules once. Bags and character-related features use docked side panels. Frames and background textures are pooled.

The cross bar replaces the eight standard action bars using ConsolePort's Crossbar: Minimal layout: two four-button crosses with bumpers above triggers between them. Default bars remain hidden except while dragging spells or other actions; dropping or canceling the drag hides them again. Slots 1–4 map clockwise to D-pad Up, Right, Down, Left; slots 5–8 map to Y, B, A, X in their Xbox positions. RT uses slot 9 and RB uses slot 10. LT and LB display their Shift and Control modifier roles without action bindings. Place actions in the first ten slots of each Retail Edit Mode bar:

| Hold | Action bar |
| --- | --- |
| Nothing | 1 |
| Shift or LT | 6 |
| Control or LB | 7 |
| Shift + Control or LT + LB | 8 |

Modifier switching and action activation use secure handlers. Buttons show native cooldown sweeps and remaining seconds, including charge recharge. Controller bindings are temporary overrides; the module restores the previous modifier CVars and built-in bars on shutdown. Binding configuration and action placement are not implemented yet.

Use `yarn test`, `yarn typecheck`, and `yarn build` to verify changes. Generate game API declarations with `yarn setup`.
