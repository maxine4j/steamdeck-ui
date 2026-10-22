# Retail Prey map sources

Verified 2026-10-23. No English title parsing or category name matching is used.

- [Plumber SharedData.lua](https://github.com/Peterodox/Plumber/blob/af2f562ec474f688fd0ae5ea50e70888dda12df8/Modules/Shared/SharedData.lua), `PreyQuestData`: numeric offer quest → difficulty and criterion ID. All 94 entries were compared with the compressed ranges in `PreyTargetsClient`.
- [Plumber HuntTable.lua](https://github.com/Peterodox/Plumber/blob/af2f562ec474f688fd0ae5ea50e70888dda12df8/Modules/HuntTable.lua): list achievements 42701 (Normal III), 42702 (Hard III), 42703 (Nightmare III); new Nightmare targets 95021/95022 use 63452 and 95023/95024 use 63451, criteria 115704–115707. These facts are queried using `GetAchievementCriteriaInfoByID`. The III target sets also cover the I/II progression tiers; we do not scan unrelated cooking/fishing/PvP achievements.
- [Prey Hunt Tracker achievements](https://github.com/VamooseDevelopment/prey-hunt-tracker/blob/main/PHT_Achievements.lua): corroborates using actual criterion completion, rather than marking every target because its containing achievement is unfinished. Its English name lookup is not used here.
- Local Blizzard `Blizzard_FrameXML/InstanceDifficulty.xml` and `.lua`: `ui-hud-minimap-guildbanner-normal-large`, `-heroic-large`, and `-mythic-large` are the distinct native difficulty skull artwork. Hard uses Heroic; Nightmare uses Mythic.
- Local Blizzard `Blizzard_SharedMapDataProviders/QuestOfferDataProvider.lua` and `.xml`: `QuestNormal` is the normal quest exclamation artwork used for the separate achievement badge.
- Local Blizzard `Blizzard_AdventureMap/AM_QuestOfferDataProvider.lua`, `AM_QuestChoiceDataProvider.lua`, `AM_QuestDialog.lua` and `Blizzard_MapCanvas/Blizzard_MapCanvas.lua`: offer/choice templates, `questID`, full-map positions (including inset pins), native hover/click/decline flow, and pin acquisition/removal refresh hooks.
- `WowEventBus` already translates `ACHIEVEMENT_EARNED`, `CRITERIA_UPDATE`, and `RECEIVED_ACHIEVEMENT_LIST` into `ACHIEVEMENTS_CHANGED`; the client invalidates its bounded target cache through this injected event bus.

Higher difficulty credit changed in 12.1. We do not infer cross-difficulty credit: the offered difficulty's live achievement and exact criterion are authoritative. Missing criterion data produces no badge. Unknown future quest IDs retain Blizzard artwork and navigation. Adding new targets requires verified numeric data. Native textures are only hidden while a pooled overlay owns the pin and restored when that ownership ends; their atlases and quest tooltip content are untouched.

Validation here uses mocked Retail globals and Lua compilation. Artwork sizing, tooltip interaction, and controller navigation still require an in-game check on a live hunt table.
