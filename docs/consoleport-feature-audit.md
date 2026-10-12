# SteamDeck UI feature coverage audit

Audit date: 12 October 2026.

## Scope and conclusion

SteamDeck UI targets a **complete, purpose-built Retail UI replacement for a small controller-driven screen**. Every interactive replacement should expose our own navigation grid. Generic interface cursors, navigation over Blizzard frames, and default-frame interoperability are deliberately excluded from the target feature set.

We have the action-bar foundation and seven feature panels. We do not yet have the complete everyday gameplay loop: interact, accept a quest, navigate to it, use its special item, select a reward, loot, sell, repair, and continue. Completing those flows matters more than matching ConsolePort's settings or adding every collection browser.

**Zero configuration does not mean zero player choices.** Selecting spells, talents, equipment and favourites is normal gameplay. Requiring players to arrange specific numbered Blizzard action bars or drag items through Blizzard windows is setup friction. Our current action placement and ability-ring population still have that friction.

This is a source audit, not an in-game usability or combat validation. “Missing” means no dedicated implementation was found in our registered modules, clients or components; Blizzard may still show the underlying window. That does not count as replacement coverage.

## Evidence and baseline

- Our working tree, with repository HEAD `5915292` at completion. Dungeon Finder was uncommitted at the start of the audit and was committed during it; it is counted as implemented in source, without claiming in-game validation.
- Local `.libraries/ConsolePort` snapshot, whose core TOC declares **3.3.10**. This directory does not provide an independently verified upstream commit for this audit.
- Local `.libraries/wow-ui-source/Interface/AddOns`, focusing on Retail/Mainline screens and shared in-game UI. Classic-only features, login/character-creation UI and developer tools are excluded.
- Upstream [ConsolePort repository](https://github.com/seblindfors/ConsolePort) and [author's release listing](https://www.curseforge.com/wow/addons/console-port) were checked; the listing identifies 3.3.10 dated 7 October 2026. Detailed findings below use the local source, rather than assuming everything in upstream master is in this snapshot.

Priorities are product recommendations: **P0** closes a basic gameplay blocker; **P1** supports common progression/group play; **P2** adds secondary/occasional functionality; **P3** can wait. They are not defect severity ratings.

## What we already have — and where coverage stops

| Area | Present in source | Remaining coverage |
| --- | --- | --- |
| Controller input | Native gamepad enabled; analog movement; right-stick camera; fixed modifiers; restoration on shutdown | No addon-owned general target/interact/menu bindings. Native or user bindings may exist, but we do not establish these flows. |
| Cross bar | Fixed controller layout; secure modifier bars and main-bar paging; stance, vehicle, override and skyriding pages; jump; cooldown and recharge display | Controller-native action assignment; usability/range/resource feedback; spell flyouts; pet commands; remaining page slots and explicit vehicle exit. |
| Context actions | Unmodified D-pad Right prioritizes extra-action slot 169, otherwise the highest-priority active zone spell | Multiple zone abilities; tracked quest items; clear empty-state/context feedback. This is **partial coverage**, not an entirely missing feature. |
| Ability ring | One secure, stick-selected, release-to-use ring; up to 12 occupied slots; deadzone cancellation; cooldowns | Automatically populated quest/context actions; controller-native add/remove. Currently populated through Edit Mode bar 5. |
| Bags | Backpack, equipped bags and reagent bag; grouped item view; money; scrolling/focus; X use/equip, Y item menu; destroy confirmation | Split/move stacks through a controller flow; equip-slot choice; bank transfer; explicit vendor/trade actions; socket/disenchant; compare details. A on an item currently does not use it. |
| Equipment | Identity, model, gear, item level/upgrade-track details, stats and navigable slots | Equipment sets; controller-native move/unequip/use flow; inspect another player; compare and socket actions. A on a gear slot currently picks up the item. |
| Reputation | List and activation/watch behavior; modern reputation data handling | Separate rich renown reward/unlock browser. Do not count reputation as wholly missing. |
| Titles | Known title list and selection | Small feature already covered; low priority for further expansion. |
| Mounts | Collection list/details, search, filters, summon, random favourite, equipment and flight-style controls | Search text needs an input solution; mount equipment still consumes a cursor item; controller-native favourite management is not implemented. |
| Talents | Specialization switching, saved loadout switching, Blizzard starter build | Individual class/spec/hero/PvP talent editing; create/rename/import/delete loadouts; spellbook. This is a selector, not a full talent editor. |
| Dungeon Finder | Random normal/heroic/special-event/Timewalking list; role choice; join/leave queue | Specific dungeons, follower dungeons, Raid Finder, premade groups, PvP and queue accept/role-check prompts. Follower entries are explicitly filtered out. |
| Navigation | Own nav grids; focus memory; scrolling; dock/tab switching; item modal | B only cancels an active modal, not an ordinary panel. No uniform open/back/close flow or contextual button-hint strip. Ordinary panel input pauses in combat. |

The README understates panel navigation and describes older bag controls. For this report, executable source takes precedence.

Local evidence: [startup wiring](../src/start.ts), [controller input](../src/clients/controller-input-client.ts), [cross bar](../src/modules/action-bar/cross-bar.ts), [action adapter](../src/clients/action-bar-client.ts), [bags](../src/modules/bags/bags-panel.ts), [item menu](../src/modules/bags/item-action-menu.ts), [navigation](../src/ui/navigation/navigation-manager.ts), [mounts](../src/modules/mounts/mounts-panel.ts), [talents](../src/modules/talents/talents-panel.ts), [dungeon client](../src/clients/dungeon-finder-client.ts).

## Useful ConsolePort capabilities we lack or only partly cover

These are capabilities to reproduce in our own UI, not recommendations to adopt ConsolePort's default-frame navigation.

| Capability | ConsolePort evidence | Minimal SteamDeck version | Priority |
| --- | --- | --- | --- |
| World interaction and target feedback | Core `Controller/Interact.lua`, `Controller/Targeting.lua` | Fixed interact binding, visible interactable name/button prompt; sensible native soft-target defaults and explicit target cycling/lock. Avoid silently inheriting unknown user settings. | P0 |
| Ground-targeted spell placement | Core `Controller/Mouse.lua` handles spell reticles and camera/cursor transitions | A designed targeting mode with visible placement feedback and confirm/cancel; keep camera behavior predictable. No general UI cursor required. Combat feasibility needs a secure prototype. | P0 |
| Quest/context utility actions | Rings `Controller/Auto.lua` inserts/removes watched quest items, extra actions and zone spells | Auto-populate a compact context ring/list; no numbered-bar setup. Preserve our existing extra-action shortcut. | P0 |
| Controller spell assignment | Menu `View/Popup/SpellMenu.lua` places spells on bars without dragging | Select a spell, choose a displayed controller slot, confirm; show existing assignment and replacement. Fixed bindings can remain. | P0 |
| Looting | World `View/LootFrame/` | Custom loot list, item details, take/take-all/close, quest items and bind confirmations. | P0 |
| Reachable main menu | Menu `Model/Buttons.lua`, `View/Menu.lua`, `View/Ring.lua` | One fixed menu button and readable launcher for all implemented screens; consistent back/close. | P0 |
| Text entry | Keyboard `Core/Observer.lua`, `View/Keyboard.lua`, suggestion/autocorrect components | One reliable search/chat/name entry path. Evaluate Steam Deck keyboard first; build our own keyboard only if it cannot provide the required flow. Predictive dictionaries are optional. | P1 |
| Party/raid targeting | Target `View/Ring/`, `View/Cursor/Raid.lua`, `View/Hotkeys/UnitHotkeys.lua` | Own party/raid member selector with health/debuff context and secure targeting/casting. A small party selector first. Do not reproduce arbitrary frame scanning. | P1 |
| Spell flyouts | Core `View/Pie/Flyout.lua` | Own stick-select flyout for portals, summons and similar multi-spell buttons, including combat use where allowed. | P1 |
| Pet commands | World `Controller/Pet.lua` and core pet-ring implementation | Fixed pet-command ring: attack, follow, stay, stance and pet abilities/autocast. This is separate from collection pets. | P1 |
| Item context actions | Menu `View/Popup/ItemMenu.lua` | Slot-specific equip, split stack, move, sell/buyback context, trade, socket and inspect/compare. Disenchant only when applicable. Preserve destructive confirmation. | P1 |
| Unit context menu | Menu `View/Popup/UnitMenu.lua` | Own target/player menu for invite, whisper, inspect, trade, follow, focus, marker and leave group, according to available actions. | P1 |
| Action-state feedback | Bar `Model/Database.lua`; action-button library | Fixed out-of-range/resource-unavailable tint, charges/counts, active/proc feedback and ability details. Cooldowns are already covered. | P1 |
| Quick consumables and auras | World `Controller/Items.lua`, `Controller/AurasMainline.lua`, `View/QuickMenu/` | Small own quick menu for usable consumables, buff/debuff details and permitted buff cancellation. Avoid a second manually configured ring system. | P1 |
| Pings | World `Controller/Ping.lua` | Fixed contextual ping selector for group communication. | P2 |
| Vendor convenience | Core `Controller/Convenience.lua` | Explicit “Sell junk” action and repair action in our merchant UI; no settings required. Confirm policy for poor-quality equipment rather than blindly copying autosell. | P1 |
| New/temporary ability briefings | World `View/TempAbility/TempAbility.lua` | Brief readable card showing ability and controller binding when acquiring temporary actions or entering a vehicle. | P2 |
| Cinematic controls | Core `Controller/Convenience.lua` | Own skip/resume prompt with standard confirm/cancel. | P2 |
| Modifier latching | Core `Model/Data/Variables.lua` and input layers | Potential accessibility feature to reduce sustained trigger holding. Defer unless testing shows a need; no multi-mode configuration suite. | P2 |

**Retail distinction:** World `Controller/GroupLoot.lua` exits on modern clients. Do not cite its combat quick-menu rolls as Retail parity. ConsolePort's interface cursor also has popup/group-loot handling, but that mechanism is excluded here. Our own Retail loot-roll and confirmation UI is still missing and belongs in the screen inventory below.

**Already matched enough for this scope:** native gamepad use, analog movement, secure action paging, fixed cross-bar presentation, hold/point/release ring selection, cooldown/recharge display and modifier controls. Extra actions and zone abilities need expansion, not reinvention.

## Missing replacement UI inventory

This is a practical inventory of distinct user-facing surfaces and subflows, not every internal Blizzard frame. None of the missing rows should be read as a claim that ConsolePort supplies a custom replacement for that screen. It often operates Blizzard's screen instead; we will design our own.

### Everyday gameplay and world UI

| Missing surface | Essential actions/content | Priority |
| --- | --- | --- |
| Main/game menu | Open feature screens, help/control legend, logout/exit, system access | P0 |
| Gossip and NPC dialogue | Select dialogue/services, back, close | P0 |
| Quest offer/progress/turn-in | Read objectives, accept/decline, choose reward, complete; autocomplete quests | P0 |
| Quest log and objective tracker | Quest detail, track/untrack, abandon confirmation, special item, campaign/world-quest progress | P0 |
| World map | Zone hierarchy, pan/zoom, quests, POIs, coordinates/waypoint selection | P0 |
| Minimap interactions | Tracking selector, useful icons, location and navigation context | P1 |
| Flight/taxi map | Available routes, destination selection, fare and confirmation | P1 |
| Loot window | Item details, take/take-all, close, full bags and bind prompts | P0 |
| Merchant | Buy/quantity, sell, buyback, repair, junk action | P0 |
| Global confirmations | Bind-on-pickup/equip, delete, purchase, quest abandon, resurrection and other required yes/no decisions | P0 |
| Death/release/resurrection | Release spirit, accept resurrection, recovery/recap | P0 |
| Player-choice interactions | Scenario/delve/quest choices and reward selection | P1 |
| Cinematics and tutorial prompts | Skip/resume/dismiss with readable hints | P2 |

### Inventory, character and progression

| Missing or incomplete surface | Essential actions/content | Priority |
| --- | --- | --- |
| Personal/reagent/account bank | Browse, deposit/withdraw, stack movement and unlocks; bags currently exclude banks | P1 |
| Guild bank | Tabs, deposit/withdraw, permissions and money | P2 |
| Mail | Inbox, read, take attachments/money, delete/return, send/COD | P1 |
| Player trade | Offer items/money, accept/cancel, changed-offer feedback | P1 |
| Equipment sets — missing subflow | Save/select/equip/delete sets | P1 |
| Equipment compare/inspect — missing subflow | Compare bag item against chosen gear slot; inspect another player | P1 |
| Currency pane | Currency balances, caps, tracked currencies and descriptions | P1 |
| Spellbook | Class/general/pet abilities, details and action assignment | P0 |
| Full talent editor — selector exists | Class/spec/hero trees, points, undo/apply, loadout lifecycle | P1 |
| PvP talents/War Mode | Selection and availability/state feedback | P2 |
| Renown/major factions — reputation list exists | Milestones, rewards, unlocks and activities | P2 |
| Item upgrade | Item selection, track/rank, costs, preview and confirmation | P1 |
| Item socketing | Gem slot selection, inventory candidates, replacement confirmation | P2 |
| Item conversion/catalyst/interactions | Input item, preview result, costs and confirmation | P2 |
| Achievement browser | Categories, search, progress, track and rewards | P2 |
| Professions and crafting | Recipes, reagents, quality, quantity, craft, specialization | P1 |
| Crafting orders | Browse/place/fulfil orders, costs, commission and confirmation | P2 |
| Trainers | Eligible skills, costs and purchase | P2 |
| Auction House | Search, buy, sell, bids, owned auctions and price confirmation | P2 |
| Black Market Auction House | Listings, bid costs, bid confirmation and status | P3 |
| Hunter stable | Active/stabled pets, swap, details and specialization where available | P1 for hunters |
| Barber/customization | Appearance preview, choices, cost, apply/cancel | P3 |
| Macros | Select/edit/create macros and assign to fixed controller slots | P2 |

### Group play, journals and rewards

| Missing or incomplete surface | Essential actions/content | Priority |
| --- | --- | --- |
| Dungeon Finder completion — partial panel exists | Specific/follower selection, queue status/estimate, role checks, ready/proposal accept, teleport in/out | P0 for queue prompts; P1 for remaining selection |
| Raid Finder | Wing selection, roles, join/leave and proposals | P1 |
| Premade Group Finder | Search/filter, listing details, apply, invitations, create/list/manage group | P1 |
| PvP queue UI | Battlegrounds, rated modes, skirmishes, roles and entry prompts | P2 |
| Dungeon/raid journal | Instances, difficulty, bosses, mechanics, loot, role/spec filtering | P1 |
| Adventure Guide | Suggested content and rewards; distinct from boss journal | P2 |
| Mythic+ panel | Keystone, dungeon ratings, affixes, season progress | P1 |
| Great Vault | Objectives/progress, reward comparison, selection confirmation | P1 |
| Delve difficulty/companion | Difficulty choice, companion configuration and applicable rewards | P1 |
| Party/raid controls | Members, role/leader actions, ready check, markers, permissions, leave | P1 |
| Group loot rolls | Item comparison, need/greed/pass and permitted alternatives, timer and confirmation | P1 |
| Instance lockouts | Saved raids/dungeons, reset and extension controls | P2 |
| PvP scoreboard/end-of-match | Results, rewards and leave/requeue | P2 |
| Battlefield map | Compact battleground objectives and location view | P2 |

### Collections, social, housing and system UI

| Missing or incomplete surface | Essential actions/content | Priority |
| --- | --- | --- |
| Toy Box | Search/filter, owned/usable toys, details, favourite/use | P2 |
| Pet Journal | Search/filter, details, summon/rename, team slots, heal/revive | P2 |
| Pet battles | Own battle action selection, switch/trap/pass/forfeit, team/enemy state | P2; separate feature from Pet Journal |
| Appearance/wardrobe collection | Search/filter, sources, sets and model preview | P2 |
| Transmogrifier | Choose appearance/outfit per slot, preview, cost, apply/cancel | P2 |
| Heirlooms | Browse/filter, create and upgrade where permitted | P3 |
| Mount collection completion — panel exists | Set/unset favourite, independent equipment selection, usable text entry | P2 |
| Chat | Read/channel switching, compose/reply, links, whisper and minimal moderation controls | P1 |
| Friends/Battle.net | Online list, invite, whisper, add/remove and requests | P1 |
| Guild/communities | Roster, chat, invites, announcements and useful membership actions | P2 |
| Calendar | Events, invitation responses and creation | P3 |
| Pings and unit menu | Group pings; context actions on selected players/units | P2 for pings; P1 for unit actions |
| Trading Post | Catalogue, preview, purchase/refund/freeze, monthly progress | P2 |
| Housing | Dashboard/house selection, decor inventory, editor controls, placement, neighbourhood/service interactions | P3 initially; large independent scope |
| Expansion landing/event screens | Current expansion progression, events and reward choices | P2 as encountered |
| Notifications/status tray | Pending rewards, invites, queue status and actionable alerts | P1 for required responses; P2 for informational alerts |
| Legacy expansion screens | Garrisons/missions, order hall, artifact/Azerite, covenants/soulbinds, islands/warfronts, archaeology and old scenario pickers | P3; implement only supported/accessible Retail flows |
| System/settings/help | Essential graphics/audio/accessibility controls, addon status, error/reload/help | P2; retain essential choices without recreating exhaustive customization |
| Shop/account catalogue | Browse, preview and purchase confirmation | P3 |

HUD coverage is also incomplete: custom player/target/focus/party/raid frames, health/resources, cast bars, buffs/debuffs, nameplates, encounter warnings/timeline, boss/arena information, durability and queue notifications. These are **missing replacements**, even when Blizzard still renders the information. Prioritize readable player/target/party state first; incidental HUD decoration can wait.

Blizzard-source inventory evidence: `Blizzard_UIPanels_Game`, `Blizzard_WorldMap`, `Blizzard_FlightMap`, `Blizzard_Collections`, `Blizzard_EncounterJournal`, `Blizzard_GroupFinder`, `Blizzard_PVPUI`, `Blizzard_PlayerSpells`, `Blizzard_Professions`, `Blizzard_WeeklyRewards`, `Blizzard_Delves*`, `Blizzard_Housing*`, and the corresponding named screen addons under `.libraries/wow-ui-source/Interface/AddOns`.

## Recommended delivery order

1. **Finish the control contract:** launcher binding, own back/close behavior, contextual button hints, text entry, interact/target defaults and spell assignment. Keep our nav grids as the only interface-navigation mechanism.
2. **Complete solo questing:** own gossip/quest/reward UI, quest log/tracker, map, loot, vendor/repair, confirmations/death, and automatically available quest/context actions. Prototype ground targeting early.
3. **Complete a dungeon end to end:** finish queue/role/proposal prompts; own party HUD/target selection, loot rolls, pet commands, vehicle exit and instance controls. Existing random-queue selection alone is insufficient.
4. **Progression:** spellbook/full talents, bank/mail, currencies, upgrades, professions, premade groups, journal, Mythic+/Vault/delves.
5. **Collections and secondary systems:** Toy Box, pets, wardrobe/transmog, achievements, guild/social extras, Trading Post; housing and legacy systems afterward.

A finished flow should be usable from controller input to completion without a mouse, drag-and-drop dependency or visible Blizzard window. Test it on Steam Deck resolution and in the relevant combat state. Protected actions need secure component APIs; ordinary nav-grid callbacks are not a substitute for secure combat execution.

## Deliberately excluded ConsolePort scope

No generic interface cursor/default-frame bridge; arbitrary frame scanning; configurable action-bar layouts/themes/positions; profile import/export; controller calibration wizard; broad device support; arbitrary binding layers/chords; multiple user-designed/nested rings; advanced movement macros; extensive keyboard languages/dictionaries; LED/battery features; skinning integration or Classic compatibility.

Fixed, automatic behavior can still reuse an underlying idea. In particular, spell placement is a required gameplay action even if our bindings never change, and party targeting is a gameplay capability even though we do not want ConsolePort's raid-frame cursor mechanism.
