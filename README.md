# SteamDeck UI

Controller-first UI for Retail World of Warcraft, written in TypeScript and compiled to Lua.

Run `yarn build`, then copy the contents of `dist/` into an `Interface/AddOns/SteamDeckUI-dev/` directory. Log in or reload the UI. Use `yarn build:release` to build the published addon for `Interface/AddOns/SteamDeckUI/`.

GitHub Actions runs tests, typecheck, lint, and builds on pull requests, pushes to `main`, and new tags. Successful `main` builds publish `main-<short-sha>` prereleases; tags publish stable releases. Each release includes `SteamDeckUI.zip`, containing a `SteamDeckUI/` folder ready to extract into `Interface/AddOns/`. The packaged TOC version matches the release name. Workflow reruns replace the existing ZIP rather than creating another release.

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

Unmodified D-pad Up opens an ability ring in the center of the screen while held, replacing main-bar slot 5. Populate Retail Edit Mode **bar 5** (the second right-side bar, action slots 37–48) to configure it. Empty slots are excluded and the remaining 1–12 actions are arranged clockwise from the top. Hold the right stick toward an action and release D-pad Up to use it; returning the stick to the center cancels. A line from the center tracks the exact stick angle and deflection, with subdued feedback inside the cancellation deadzone and gold feedback when an action is selected. The right stick controls selection instead of the camera while the ring is open. Selection and release casting use secure handlers and work during combat. Modified D-pad Up still uses slot 5 of bars 6–8. Panel navigation takes priority over opening the ring outside combat.

Ring icons show the same native cooldown and charge recharge sweeps and compact countdown numbers as the action bars. Right-stick camera input remains suppressed for 200 ms after releasing the ring bind, giving the stick time to return to center without turning the camera.

Use `yarn test`, `yarn typecheck`, and `yarn build` to verify changes. Generate game API declarations with `yarn setup`.

NPC conversations replace Blizzard gossip and quest dialogue with a centered, transient panel. Supported pages include both gossip and quest greetings, quest offers (including item-started offers), autoaccept acknowledgement, progress and requirements, rewards, shared offers, and remote completion notifications. NPC conversations zoom the camera to a closer distance and restore its previous distance on close or combat suspension. Item-started and remote offers do not zoom. There is no automatic quest acceptance or turn-in.

Use the D-pad to move between reading and choices. On the reading control, A scrolls down and Y scrolls up; the reading percentage shows progress. A activates choices and action buttons. Select a reward before choosing **Claim rewards**, then confirm the claim. A single reward choice is preselected; claiming still requires confirmation. Paid gossip, completion costs and PvP acceptance warnings require confirmation. B dismisses the current confirmation first, otherwise declines/closes the conversation. Closing restores the previous panel's focus. Reward-data refresh preserves reading position, selection and focus.

For gossip codes, select **Enter code** and press A to focus the custom text field, then use Steam+X to open the Steam Deck keyboard. Close the keyboard, select **Confirm**, and press A to submit. This hardware input path requires testing on the Deck; an invisible Blizzard input field is never used. Quest and gossip actions suspend during combat, with a visible message. No action is queued to execute after combat; ending an interaction during combat discards it.

Service gossip options invoke their original game action and release conversation focus when the service opens. Merchant, trainer, taxi, bank, innkeeper/binding and other service destinations still use Blizzard UI; this module does not replace them. Quest log, map, objective tracker and service interfaces are outside this feature's scope. Native frame suppression and controller code entry, camera distance, combat transitions, and actual 1280×800/1280×720 layouts still need in-game verification. Unit tests cover state/actions, control reachability, reuse and layout bounds, but do not establish native rendering or protected-action correctness.
