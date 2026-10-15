---
name: feature-audit
description: Audit SteamDeckUI feature coverage against the embedded, scoped Retail UI checklist. Report partial coverage and wholly missing workflows, then a coverage percentage and brief summary. Use for feature parity investigations, not implementation or performance audits. NEVER AUTOMATICALLY INVOKE THIS SKILL. ONLY INVOKE IT IF THE USER EXPLICITY REQUESTSIT.
---

# Feature audit

Investigate the current SteamDeckUI source without changing code. Return the report in chat. This file contains the comparison baseline: do not read `.libraries/wow-ui-source`, other default UI source, or browse the web to rebuild the feature inventory. Do not assume findings from an earlier audit remain true.

## Investigation

- Read `AGENTS.md`, inspect current registrations in `src/start.ts` and `src/main.ts`, then trace clients, modules, panels, components, navigation and relevant tests. Use `rg` first. Paths may change; follow the current implementation.
- Evaluate every numbered check below, including capabilities previously implemented. A class, API declaration, client method or test mock alone does not establish a usable feature: trace its entry point, controller reachability, action and refresh/close lifecycle.
- Credit native Blizzard content when it is hosted and controller accessible. A native window left available without adaptation is not SteamDeckUI coverage. Generic popup navigation does not imply coverage of the destination window or non-button controls.
- Distinguish confirmed omissions from uncertainty. For suspected absence, inspect registrations and search for equivalent behavior beyond the obvious module name. Cite source evidence for implemented portions and the inspected scope for absences.
- Check suppression carefully: a replacement can hide access to native functions it has not recreated. Identify these regressions explicitly.
- Source and unit tests establish implementation evidence, not actual Steam Deck usability or protected-action correctness. Do not automatically mark everything partial solely because an in-game run was unavailable; state that validation limitation once.
- Do not build, regenerate declarations, install dependencies or write report files for this read-only audit. Existing test results may inform findings; run focused non-mutating checks only if they resolve a specific uncertainty.

## Classification and percentage

Maintain a ledger with one status per numbered check, preserving its ID:

- **Complete (F):** all required behavior in that check has a connected, controller-accessible implementation, supported by source evidence.
- **Partial (P):** some required behavior works, but a concrete required part is missing, inaccessible or incomplete. Score 0.5.
- **Missing (M):** no usable implementation of the check was found. Score 0.
- **Unverified (U):** available evidence cannot establish implementation coverage. Score 0 conservatively; do not present uncertainty as a confirmed omission.

Complete checks score 1. Each numbered check has equal weight; do not split checks, add checks, duplicate credit or change weights between runs. Multiple behaviors within a check share its single score. This is **source-level coverage of this scoped checklist**, not a percentage of every Blizzard UI control or an in-game pass rate.

`N = F + P + M + U`; `coverage = 100 × (F + 0.5 × P) / N`, rounded to one decimal place. Reconcile all ledger IDs and counts before reporting. All checklist entries count even if the local character has not unlocked them. Intentional exclusions below never enter the denominator; no ad hoc not-applicable deductions. Only explicit user scope changes may change the denominator, and those changes must be disclosed.

## Embedded required checklist

Each heading is a workflow family used to group the report. Every numbered line is one scoring unit. Audit existing capabilities as well as gaps; this checklist does not assert current implementation status.

### Bags

- BAG-01: Browse carried items, counts, grouping, money and item details/comparisons with controller navigation and scrolling.
- BAG-02: Use/equip items, choose item-use targets and destroy items with appropriate confirmation.
- BAG-03: Search carried items.
- BAG-04: Replace equipped bags and configure native bag assignment/category filters.
- BAG-05: Select carried items for merchant sales, bank deposits, mail attachments and auction selling through reachable controller interactions.

### Personal and warband bank

- BANK-01: Browse personal and warband items and transfer items to/from carried bags.
- BANK-02: Purchase additional bank tabs with cost confirmation and availability checks.
- BANK-03: Deposit/withdraw warband gold, including arbitrary valid amounts.
- BANK-04: Search bank contents.
- BANK-05: Automatically deposit eligible items into the selected bank type.

### Character, titles and equipment

- CHAR-01: Inspect equipment, item levels, upgrade tracks and comparison tooltips; use, equip, substitute and unequip items.
- CHAR-02: View character identity, model and core stats, with controller model rotation/zoom.
- CHAR-03: Inspect native stat breakdowns/tooltips and defensive details.
- CHAR-04: Create/save/equip/rename/delete equipment sets, choose ignored slots and assign sets to specializations.
- CHAR-05: Browse earned titles, select a title and remove the current title.

### Talents and spellbook

- SPELL-01: Switch specialization, select saved talent loadouts and select a starter build.
- SPELL-02: Allocate/refund talent ranks, resolve choice/hero nodes and reset/undo/apply changes through the hosted tree.
- SPELL-03: Create/rename/delete/import/export/share talent loadouts.
- SPELL-04: Search the talent tree.
- SPELL-05: Select PvP talents and toggle War Mode where allowed.
- SPELL-06: Browse current player spells/passives, inspect details and cast supported spells.
- SPELL-07: Bind supported spells using the addon's supported controller binding scheme.
- SPELL-08: Browse and use the pet spellbook.

### Actions, rings and combat pets

- ACTION-01: Activate crossbar actions with modifiers and dynamic main/stance/vehicle/override paging, including secure combat operation.
- ACTION-02: Open/select/cancel/release ability, class and utility rings; activate their actions, including combat operation.
- ACTION-03: Access jump, random favourite mount, quest items, zone abilities and extra actions.
- ACTION-04: Display cooldown/recharge feedback, remaining time and charge/item counts.
- ACTION-05: Display range/resource usability, active/toggled state and proc highlights on actions.
- ACTION-06: Configure controller bindings and crossbar/ring presentation layouts. General action placement and macro editing are excluded below.
- ACTION-07: Use combat-pet commands and class forms/stances; control pet autocast and display its active/autocast/stance states.
- ACTION-08: Use vehicle exit/dismiss and vehicle-specific controls beyond ordinary action-slot paging.

### Dungeon finder and PvP queues

- FIND-01: Choose roles and queue/leave random, specific and follower dungeons, with eligibility and reward information.
- FIND-02: Browse and queue/leave eligible raid-finder wings across available expansions and inspect boss/reward information.
- FIND-03: Search/filter premade PvE groups, apply/withdraw applications and create/edit/remove listings or accept/decline applicants.
- FIND-04: Queue/leave quick, rated, specific battleground and training PvP activities with role/eligibility information.
- FIND-05: Search/filter/apply/list/manage applicants for premade PvP groups.
- FIND-06: Respond to dungeon/PvP proposals and role checks and inspect/manage queue status.
- FIND-07: Inspect PvP ratings, seasonal progression and rewards, match scoreboards and results.

### Auctions, merchant and mail

- TRADE-01: Browse/search/favourite auction items, inspect listings and purchase commodities or item buyouts with confirmation.
- TRADE-02: Filter auctions by category/quality/level/usability and select result sorting.
- TRADE-03: Select sale items, configure quantity/price/duration, inspect deposits and post auctions, including supported token sales.
- TRADE-04: Inspect owned auctions and cancel eligible auctions.
- TRADE-05: Place non-buyout bids and inspect/manage bids.
- TRADE-06: Browse merchant items/costs, buy specified quantities, apply merchant filters, sell items and use buyback.
- TRADE-07: Repair all, repair with guild funds when permitted and sell junk.
- TRADE-08: Read inbox messages/invoices/order details; collect money/items including COD; return/delete/report mail and copy letters.
- TRADE-09: Compose/send recipient, subject, body, money/COD and attachments; remove attachments and handle send failures.
- TRADE-10: Complete mail recipients from native-style suggestions through controller navigation.

### Achievements and collections

- COLL-01: Browse achievement categories/summary, completion states, criteria, chains and reward details; follow achievement links.
- COLL-02: Search achievements, track/untrack them, inspect statistics and insert achievement links into chat.
- COLL-03: Search/filter mounts, summon/dismiss, manage favourites/random favourites, apply mount equipment and use flight-style controls.
- COLL-04: Inspect mount descriptions and acquisition sources.
- COLL-05: Search/filter toys, inspect details/cooldowns, use toys and manage favourites.
- COLL-06: Search/filter companion pets, inspect collection/source details, summon/dismiss and manage favourites/random summons.
- COLL-07: Browse appearances by equipment slot, distinguish collected status and preview/clear/restore a character outfit.
- COLL-08: Search/filter appearances; inspect alternate sources; favourite/track appearances and browse weapon-enchantment appearances.
- COLL-09: Browse appearance sets and completion status; manipulate the character appearance preview with the controller.
- COLL-10: Browse/create/upgrade heirlooms.
- COLL-11: Browse and select/customize warband scene collections.

### Reputation and currency

- REP-01: Inspect faction standing/progress, track/untrack factions and change inactive/at-war states where supported.
- REP-02: Open major-faction/renown details and inspect reward tracks/unlocks.
- REP-03: Inspect currency balances/caps, favourite currencies and mark active/inactive.
- REP-04: Select other-character currency sources, inspect transfer costs/limits and transfer arbitrary valid amounts with confirmation/results.
- REP-05: Change which currencies are shown in Blizzard's backpack display.

### Map, quests and NPC dialogue

- QUEST-01: Open/navigate/zoom the world map, inspect/interact with map pins and set waypoints using the controller.
- QUEST-02: Browse/collapse quest headers, read quest details/rewards, track/supertrack/share/abandon quests.
- QUEST-03: Use quest-log settings, Events and map legend tabs, and quest-session management.
- QUEST-04: Read/select gossip, enter codes, confirm paid actions and hand off to NPC services.
- QUEST-05: Handle quest greetings/offers, item-started/shared offers, acceptance, progress/requirements, reward choice/claim and remote completion.
- QUEST-06: Preserve dialogue reading/focus/reward selection on refresh; handle close, confirmations and combat transitions safely.
- QUEST-07: Navigate objective-tracker entries/context actions for quests, achievements and scenarios/delves/dungeons. Profession/recipe tracking is excluded.

### Transmog and native dialogs

- NATIVE-01: Browse/select/apply transmog changes, inspect costs, manage service outfits and use hosted filters/search/dropdowns.
- NATIVE-02: Reach transmog model manipulation, sliders, alternate actions and any required protected controls through supported controller interactions.
- NATIVE-03: Navigate the game menu and standard/special confirmation dialogs, including text input and non-button controls when required.
- NATIVE-04: Respond to party/raid ready checks. Initiating or administering them is excluded.

### Entire gameplay workflows

- WORLD-01: Navigate loot items and group-loot need/greed/transmog/pass decisions and inspect rolls.
- WORLD-02: Trade items/gold with players, use non-traded enchant slots, review changes and accept/cancel.
- WORLD-03: Use friends/Battle.net/request/ignore/recent-allies lists and player social/context actions, excluding chat, guild/community and party/raid administration.
- WORLD-04: Select friendly/enemy/party/focus targets and unit-context actions with the controller, including a healing-selection workflow.
- WORLD-05: Provide controller-focused player/target/focus/party/raid frames, nameplates, cast bars, resources, buffs/debuffs and aura cancellation. Group administration is excluded.
- WORLD-06: Present and interact with experience/reputation and other HUD status displays.
- WORLD-07: Select taxi/flight-map destinations and inspect routes/use travel controls.
- WORLD-08: Browse and purchase trainer abilities.
- WORLD-09: Manage hunter stable pets.
- WORLD-10: Use barber/customization and tabard-design services.
- WORLD-12: Socket/upgrade/convert items and use catalyst, scrapping and other item-modification services outside professions/crafting orders.
- WORLD-13: Inspect Great Vault progress/rewards and select a reward.
- WORLD-14: Inspect Mythic+ seasons/ratings/history/affixes, insert keystones and manage raid lockouts/saved instances.
- WORLD-15: Select delve difficulty and configure/inspect companion progression.
- WORLD-16: Use expansion landing pages, garrison/order-hall missions, covenant/soulbind/artifact/Azerite/runeforging/Chromie Time interfaces where available, excluding profession and housing workflows.
- WORLD-17: Use player-choice, contribution and specialized world/event activity selectors and rewards beyond normal quest/gossip dialogue.
- WORLD-18: Browse the calendar, create events, RSVP and handle event invitations.
- WORLD-19: Use Trading Post catalogues, previews/purchases, frozen items and Traveler's Log tasks/progress.
- WORLD-20: Configure general game/controller keybindings, click casting and Quick Keybind, excluding macro editing and Edit Mode.
- WORLD-21: Navigate game settings, addon enable/disable management and SteamDeckUI options.
- WORLD-22: Use death/ghost/recovery controls and inspect death recaps.
- WORLD-23: Inspect other players, use standalone dress-up and read item-text/books.

## Intentional exclusions

Never report these as gaps, recommend implementing them, or include them in scoring. Exclusions take precedence over broad wording elsewhere:

- Bags: native cleanup/sorting, stack splitting, explicit empty-slot placement and a complete stack-rearrangement workflow.
- Bank: individual tab selection/organization, tab names/icons/deposit settings, cleanup and stack splitting. Bank search and automatic deposits remain required.
- Spellbook: search, general action placement beyond the supported binding scheme, non-spell/flyout entries and off-spec spells. This also excludes general crossbar action-placement editing; supported spell binding and binding/layout configuration remain required.
- Merchant: repairing one item at a time.
- Achievements: comparing with another player. Following existing links and inserting achievement links remain required; a chat interface is not required.
- Companion pets: battle-team slots, ability selection, battle queueing, battle stat/ability inspection, renaming, caging and releasing.
- Mounts: 3D mount inspection, rotation and zoom. Mount descriptions/sources remain required; character/transmog preview controls are separate.
- Quest log: search. Map: dedicated breadcrumb/map-toolbar controller navigation.
- Entire workflows: professions (including archaeology), crafting orders, chat, guilds/communities (including registration, petitions and charters), party/raid management, minimap, guild banks, Black Market auction house, encounter journal, pet battles, housing and macros.
- Alarms, stopwatch and time-manager controls. Calendar events/invitations remain required.
- Edit Mode, damage meter, encounter timeline/warnings configuration, tutorials/help, reporting forms, store/account-shop and account-service flows.

Do not let exclusions erase adjacent requirements: crafting-order mail details, guild-funded merchant repairs, existing ready-check responses and service gossip remain in scope. Native dialog coverage does not require implementing excluded destination workflows. Login/character creation and Classic-only interfaces are outside this Retail in-game checklist.

## Report format

Return exactly two feature tables in this order. Keep the report evidence-based and concise without omitting scored gaps. Group related checks when useful, retaining IDs so the score can be reconciled. Complete checks need not be listed, but count them in the ledger.

1. **Partial coverage** table: `Area / Check IDs | Existing coverage | Missing or incomplete behavior | Evidence`. Include partially covered workflow families, even when some checks within them are fully missing. Include relevant entirely complete neighboring capabilities only to explain the partial coverage. Put unresolved checks here with an explicit **Unverified** label, describing what could not be established rather than asserting absence.
2. **Fully missing workflows** table: `Workflow / Check IDs | Required functionality missing | Evidence`. Use this when all required checks for that workflow family are confirmed missing. A distinct subworkflow within a partial family may be listed here (for example heirlooms), but assign each non-complete check ID to only one table. Do not list an entirely uncertain workflow as confirmed missing.

Use actual current source paths, preferably clickable absolute file links with relevant lines. For absences, cite the registration/search scope inspected; do not fabricate a nonexistent implementation file. If a table has no findings, keep it and include a single `None` row without scoring that row.

Immediately after the tables, state the score clearly in bold, with reconciled counts and scope:

**Scoped source-level feature coverage: X.X% — F complete, P partial, M missing, U unverified; N checks.**

Then give a brief summary of the largest remaining in-scope gaps, especially lost native functionality in suppressed windows. Mention material uncertainty and lack of in-game verification once. Do not append another table, excluded-feature backlog, unrequested implementation plan or raw search transcript after the percentage.
