# Controller options (Retail)

Open **SteamDeck UI options** from the Escape game menu. The fullscreen window uses the shared metal window skin and pooled controls. Select a setting to open its values, then select the value you want directly. The current value has a checkmark. D-pad navigates the choices; Back or controller cancel returns without changing anything. Changes apply immediately and persist in `SteamDeckUIConfig.controllerOptions`.

## Available settings

| Setting | Values |
| --- | --- |
| Movement outside combat | Face movement stick; strafe and backpedal; strafe, then face stick |
| Movement in combat | Face movement stick; strafe and backpedal; strafe, then face stick |
| Camera turns character | Never; in combat; always; outside combat |
| Horizontal sensitivity | 0.5–4, in 0.25 steps |
| Vertical sensitivity | 0.5–4, in 0.25 steps |

At login, analog movement is enabled and both mixed-style strafe angles are fixed at **120°**, ignoring old saved overrides. Face movement stick uses native angle 0°; strafe and backpedal uses 180°. Tank turning is disabled so it cannot interfere with these styles. Travel and combat selections also apply on mounts; there is no separate skyriding override.

Camera follow, temporary camera look, inversion, camera comfort, walk/run threshold and tank controls are omitted. Previously saved values for removed settings are ignored. Reset clears saved overrides and restores face-stick movement, camera turning set to never, and sensitivity 1 on both axes. Shutdown restores the CVars this client changed to their pre-login values while retaining saved selections.

## Sources and limits

- ConsolePort `.libraries/ConsolePort/ConsolePort/Model/Data/Variables.lua`, Movement section: 0° faces movement and 180° preserves facing.
- ConsolePort `.libraries/ConsolePort/ConsolePort/Controller/Movement.lua`: native movement CVar mapping and camera-facing modes. Outside-combat mode resolves to native 0/2 on combat transitions.
- ConsolePort `.libraries/ConsolePort/ConsolePort/Model/Data/Console.lua`, Camera section: sensitivity ranges and temporary analog camera look. Camera look temporarily offsets the camera according to current analog look input; its yaw/pitch settings limit that offset. It does not change ordinary camera rotation speed.
- The same ConsolePort source checks `gamepadInvertPitch` availability at runtime and documents negative camera speed as inversion when separate inversion CVars are absent. A missing inversion CVar does not establish that vertical inversion itself is impossible.
- Blizzard `.libraries/wow-ui-source/Interface/AddOns/Blizzard_GameMenu/Shared/GameMenuFrame.lua`: the native menu closes through `HideUIPanel`; the injected menu action closes Escape before requesting options.

Unsupported CVars remain unavailable. Tests cover direct selection, cancellation, navigation scope cleanup, persistence, fixed login settings, combat camera modes, restoration, resizing and panel reuse. In-game layout and hardware movement need verification in Retail.
