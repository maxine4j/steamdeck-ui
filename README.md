# SteamDeck UI

Controller-first UI for Retail World of Warcraft, written in TypeScript and compiled to Lua.

Run `yarn build`, then copy the contents of `dist/` into an `Interface/AddOns/SteamDeckUI/` directory. Log in or reload the UI.

Startup injects the native frame factory, event bus, frame pool, panel orchestrator, clients, and module manager. `PLAYER_LOGIN` starts the modules once. Bags and character-related features use docked side panels. Frames and background textures are pooled.

The controller input module has no panels. It enables native gamepad input and analog left-stick movement: the character faces the stick direction and moves forward, including when pushing down and during combat. The right stick controls the camera; gamepad cursor mode and mouse-click emulation are disabled. Use a Steam Input layout that sends native gamepad inputs. Keyboard movement or mouse emulation configured in Steam Input cannot be corrected by the addon. The controller client restores its previous settings on shutdown.

With a panel open, the D-pad moves a gold focus highlight and A activates the focused control. Bags support the grouping toggle and every displayed item; A uses an item. Focused items scroll into view, and focus follows the item when bags refresh. Move toward the dock tabs to select them, then press A to switch panels. At the outer navigation edge you can move between open side containers. Other panel contents do not expose navigation yet. Navigation pauses during combat and resumes afterward; modifier combinations continue to use the action bar. B, X, Y, RT and RB continue to use the cross bar.

The cross bar replaces the eight standard action bars using ConsolePort's Crossbar: Minimal layout: two four-button crosses with bumpers above triggers between them. Default bars remain hidden except while dragging spells or other actions; dropping or canceling the drag hides them again. Slots 1–3 map to X, Y, B in their Xbox positions. Unmodified A always uses the native Jump binding and shows a dedicated jump icon, including in vehicles and while skyriding; modified A uses slot 4 of the selected secondary bar. Slots 5–8 map clockwise to D-pad Up, Right, Down, Left. RT uses slot 9 and RB uses slot 10. LT and LB display their Shift and Control modifier roles without action bindings. Place actions in the first ten slots of each Retail Edit Mode bar (main-bar slot 4 is unused):

| Hold | Action bar |
| --- | --- |
| Nothing | Dynamic main bar (bar 1, current page, stance, vehicle, or skyriding) |
| Shift or LT | 6 |
| Control or LB | 7 |
| Shift + Control or LT + LB | 8 |

Modifier switching, main-bar paging, and action activation use secure handlers, including during combat. Modifier bars take priority over the dynamic main bar, including in vehicles and while skyriding. Buttons show native cooldown sweeps and compact remaining time with s/m suffixes (such as 8s or 2m), including charge recharge. Controller bindings are temporary overrides; the action-bar module restores built-in bars and removes its bindings on shutdown. The controller input module owns the modifier CVars. Binding configuration and action placement are not implemented yet.

Use `yarn test`, `yarn typecheck`, and `yarn build` to verify changes. Generate game API declarations with `yarn setup`.
