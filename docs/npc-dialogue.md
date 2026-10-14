# NPC dialogue implementation

The feature owns one transient fullscreen-hosted conversation panel. It does not register a permanent dock tab. Its narrow surface uses the standard dark WoW window background and shared metal border on the right, leaving the left side open for the NPC camera. Light text sits above bottom-anchored reusable choices and grouped quest rewards. Rewards and reward choices use two columns; headings and actions span the full width. The action viewport grows upward to fit its measured content before scrolling, reserving at least one third of the panel height for NPC text. Short prose does not pull actions upward. Code confirmation reserves input space between the reader and actions. There is no reading-percentage label. Its exclusive navigation grid restores the previous grid and focused identity on unmount. Item, currency and spell rewards expose full tooltips on controller focus and mouse hover.

The NPC name appears in the shared title bar. Gossip has no redundant "Conversation" heading; its reader starts 48px below the window top, balancing the internal text padding with the sides. Real quest titles remain above their reader, which starts at 76px.

NPC prose is excluded from controller navigation. Opening a conversation, changing its page or entering/leaving a confirmation focuses the first option. Same-page refreshes preserve the focused option, including reward selection and delayed data updates. Controller hints describe option selection and cancellation only.

## Verified local API semantics

- `C_GossipInfo.GetAvailableQuests` and `GetActiveQuests` return quest IDs. Options supply `gossipOptionID`; identifier-less options use their supplied `orderIndex` through `SelectOptionByIndex`, as Blizzard's shared gossip implementation does. Display row numbers are never API identifiers.
- `QUEST_GREETING` uses `GetNumAvailableQuests`, `GetAvailableTitle`, `GetNumActiveQuests`, and `GetActiveTitle`. The latter returns title and completion status. Selection uses the separate global APIs with one-based indices.
- `QUEST_DETAIL` carries an optional quest-start item ID. Item-started offers are displayed directly while their original quest API context exists. `QuestGetAutoAccept` changes acceptance to `AcknowledgeAutoAcceptQuest`.
- `QUEST_PROGRESS` uses `IsQuestCompletable`, required items/currencies and money. Continuing calls `CompleteQuest`; the authoritative `QUEST_COMPLETE` event opens rewards.
- `GetNumQuestChoices` indices include item and currency choices; `GetQuestItemInfoLootType` distinguishes them. `GetQuestReward` receives the original choice index, or zero when there are no choices.
- Rewards include item, currency, spell, money, XP, honor, skill, artifact XP, title and major-faction reputation data. Missing item/spell/currency data retains a loading entry.
- `GOSSIP_CONFIRM` carries option ID, text and cost; code entry carries the option ID. Submission uses `SelectOption(id, text, true)` only after player confirmation. Cancellation calls no selection/purchase API.
- `GOSSIP_CLOSED` carries `interactionIsContinuing`. Continuing closure preserves the conversation until the next authoritative page or service-open event. Final closure is coalesced for one frame so synchronous quest/gossip transitions do not flicker.
- `QUEST_AUTOCOMPLETE` supplies the remote quest ID. An explicit review action invokes `ShowQuestComplete`; no reward is claimed automatically. Notifications arriving during a conversation wait until it ends.
- `QUEST_ACCEPT_CONFIRM` supplies the shared offer's player, title and quest ID. Acceptance uses `ConfirmAcceptQuest` and checks the current quest-log limit.

References: bundled `Blizzard_UIPanels_Game/Mainline/QuestFrame.lua`, `QuestInfo.lua`, `CustomGossipFrameBase.lua`, `Shared/GossipFrameShared.lua`, generated GossipInfo/QuestOffer/QuestLog/QuestRewards API documentation, `Blizzard_Game` event routing and `Blizzard_StaticPopup_Game/GameDialogDefs.lua`. DialogueUI's `Core.lua` informed event suppression; its `DialogueUI.lua`, `UITemplates.lua` and `ThemeUtil.lua` informed the narrow layout, stacked options and dark-theme text colors. Its gossip, quest marker and close artwork are bundled locally (see `assets/README.md`). Generic gossip speech icons are replaced at 24px while service and reward icons retain their original identity. Quest listings and primary actions use available, complete or incomplete markers; cancel/close/decline uses its close symbol. DialogueUI does not need to be installed. Its `Camera.lua` informed interaction focus, shoulder offset and camera restoration. Camera distance and each modified CVar are restored on closure, combat, service transitions and shutdown; first-person, item-started and remote/shared offers leave the camera alone.

## Suppression and lifecycle

`FrameSuppression` reparenting is unsuitable for this feature: QuestFrame's native hide callback calls `CloseQuest`. A generic script adapter records and clears owned frames' event/show/hide scripts before hiding them. QuestFrame, GossipFrame and CustomGossipFrameManager keep their existing event registrations, but do not execute dialogue scripts while the feature is enabled.

Retail GameEvent dispatch dynamically calls its prompt methods. The feature temporarily replaces only gossip-confirm, code-entry and shared-quest-confirm handlers; unrelated routing remains active. ADDON_LOADED retries suppression for late frames. Shutdown restores recorded scripts and handlers. No permanent hooks are installed.

The dialogue client validates page identity, NPC identity, quest identity, live choice availability, completion requirements, choice count/index and displayed quest cost before committing. Its submission gate is set before invoking APIs because events can be synchronous. The module processes transitions immediately and coalesces rendering. Newly rendered pages are armed after the originating input completes. Refreshing item data cannot revive a stale quest or rearm a submitted action.

## Combat policy

All action commits check `InCombatLockdown`. Ordinary controller navigation already pauses in combat. Dialogue shows suspension feedback, dismisses pending confirmations, restores camera distance, and retains only its display state. After combat, it rereads the existing interaction without executing any queued action. A conversation ended during combat is discarded. This is a suspension policy, not a claim of unrestricted combat dialogue support.

## Verification still required in game

Automated tests cover API identifiers, snapshots, confirmations, quest paths, stale/double submission, continuing closure, service transitions, reading/focus retention, controller reachability, repeated control reuse, shutdown and combat state handling. Both requested viewport dimensions are covered by layout-bound tests; mocked font measurements do not establish native visual correctness.

Test on Retail at 1280×800 and 1280×720:

1. Gossip branch, both quest-greeting paths, offer acceptance/decline, and autoaccept acknowledgement.
2. Long text, many choices, incomplete item/currency/money requirements and delayed reward data.
3. Zero, one and multiple reward choices, final claiming confirmation, cancellation and insufficient money.
4. Paid gossip, PvP warning and code submission using the focused custom EditBox with Steam+X keyboard.
5. Item-started and shared offers, remote completion, NPC switching, and previous-panel focus restoration.
6. Combat before/after selecting an option and during a confirmation; end the conversation during combat and verify it stays closed.
7. Camera zoom/restoration, native dialogue staying hidden, service transition and shutdown restoration.

Merchant, trainer, taxi, bank, innkeeper/binding and other service destinations still use their existing Blizzard interfaces. Their replacement, along with quest log/map/objective tracker UI, is outside this feature.
