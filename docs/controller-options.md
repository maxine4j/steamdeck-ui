# Controller options (Retail)

Open **SteamDeck UI options** from the Escape game menu. The fullscreen window uses the shared metal window skin and pooled controls. D-pad moves through settings; select advances a value and the adjacent **Previous** button goes backward. Changes apply immediately and persist in `SteamDeckUIConfig.controllerOptions`.

## Available settings

| Category | Settings |
| --- | --- |
| Player control | Independent travel/combat movement styles: face stick, strafe then face stick, strafe/backpedal, tank turn/backpedal; adjustable travel/combat strafe angles (0–180°, 5° steps); separate skyriding mount style; analog movement; walk/run stick threshold; tank turn speed |
| Camera control | Camera turns character: never, in combat, always, outside combat; horizontal/vertical sensitivity; horizontal/vertical inversion |
| Camera comfort | Keep character centered; reduce unexpected camera movement; experimental dynamic pitch and shoulder offset |
| Camera follow | Follow movement stick; follow delay; follow ease in |
| Camera look | Temporary horizontal/vertical look limits |

Choose the same travel/combat style for always-on behaviour. Custom strafe angles apply to the strafe-then-face style; face stick always uses 0° and backpedal/tank always use 180°. Tank turn speed changes with combat state. The skyriding override uses mounted + can-glide state, including standing on the mount, and clears on dismount or switching to a mount that cannot glide. It does not override ordinary mounts.

Movement and sensitivity retain the addon's previous defaults. Other camera preferences remain untouched until explicitly edited. Unsupported CVars appear as unavailable and cannot be changed. Dynamic pitch and shoulder offset conflict with character centering; the descriptions explain this without silently changing another preference. Reset clears saved overrides, restores movement/sensitivity defaults and returns optional camera settings to their pre-login values. Shutdown restores every CVar owned by this client while retaining saved selections for the next login.

## Verified sources and limits

- ConsolePort `.libraries/ConsolePort/ConsolePort/Model/Data/Variables.lua`, Movement section: analog movement, travel/combat angles, walk/run threshold and camera-facing modes. Its descriptions establish 0° as face movement and 180° as preserve facing.
- ConsolePort `.libraries/ConsolePort/ConsolePort/Controller/Movement.lua`: maps those settings to native CVars. Its `GetTurnWithCameraValue` resolves outside-combat mode to native 0/2 on combat transitions; 3 is an addon pseudo-value and is never sent to the game here.
- ConsolePort `.libraries/ConsolePort/ConsolePort/Model/Data/Console.lua`, Camera section: the full camera setting set above, documented ranges and centering conflicts. Its CVar descriptions establish nonzero `GamePadTankTurnSpeed` as tank movement.
- Blizzard `.libraries/wow-ui-source/Interface/AddOns/Blizzard_APIDocumentationGenerated/PlayerInfoDocumentation.lua`: `C_PlayerInfo.GetGlidingInfo` returns is-gliding, can-glide and speed. `UnitDocumentation.lua` documents `PLAYER_MOUNT_DISPLAY_CHANGED`; the injected event bus combines that with can-glide/gliding changes and entering world.
- Blizzard `.libraries/wow-ui-source/Interface/AddOns/Blizzard_GameMenu/Shared/GameMenuFrame.lua`: the menu closes through `HideUIPanel`. The generic native-menu adapter owns insertion/layout; the injected feature action closes Escape before requesting options, which also releases the portrait menu through its existing visibility hook.

ConsolePort-specific macro expressions, jump/casting/vehicle overrides and device mapping tools are outside this options panel. Camera look limits affect Retail's temporary analog-look feature; they do not convert the normal camera stick into a separate input mode. Native unsupported options are disabled rather than emulated. Automated tests cover persistence, conditional mappings, restoration, native menu coexistence, logical controller editing/cancel, resizing and frame reuse. In-game layout and hardware movement still need verification in Retail.
