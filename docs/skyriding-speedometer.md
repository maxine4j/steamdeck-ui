# Skyriding speedometer

The bar sits at bottom-center, 14 pixels above the cross bar's highest 48-pixel
control (bottom offset 106). Cyan shows ordinary speed, the gold tick marks the
unboosted maximum, and purple shows excess speed from boosts. The readout uses
yards per second. Unexpected speed above the configured boost range expands the
display scale instead of clipping the excess.

The client requires all three conditions: `GetGlidingInfo().isGliding`,
`GetGlidingInfo().canGlide`, and `IsMounted()`. Grounded mounts, steady flight,
ordinary falling, Soar and unmounted flight forms do not show the bar. Retail
gliding events start or stop a single 50 ms scheduled update; there is no idle
polling. Leaving the world or shutting down cancels updates and hides the bar.
The four generic pooled frame components survive ordinary flight transitions
and release their native frames on module shutdown.

## API and speed-limit evidence

Verified against the local Retail Blizzard sources:

- `Blizzard_APIDocumentationGenerated/PlayerInfoDocumentation.lua`,
  `GetGlidingInfo`: returns `isGliding`, `canGlide`, `forwardSpeed`.
- `Blizzard_FrameXML/MotionSickness.lua`, `OnUpdate`: Blizzard uses these same
  values to drive its flight motion effects.
- `Blizzard_APIDocumentationGenerated/UnitDocumentation.lua`: documents
  `PLAYER_IS_GLIDING_CHANGED` and `PLAYER_CAN_GLIDE_CHANGED`.

Blizzard's generated API surface does not expose cruising/boost caps. The
centralized client constants follow the maintained Retail implementation in
[DragonRider's Speedometer.lua](https://github.com/keyboardturner/DragonRider/blob/bc7dca5d4d8ca5a9477915565f95ba156838e37c/Speedometer.lua#L1219-L1267)
(last changed 2026-04-05, checked 2026-10-23), rather than treating those values as
Blizzard-published constants:

| Flight region | Ordinary maximum | Boost range |
| --- | ---: | ---: |
| Dragon Isles and dragon races | 65 yd/s | 100 yd/s |
| Other regions, including Khaz Algar and Midnight | 55.25 yd/s | 85 yd/s |

The current upstream `DragonRider.lua` `DragonRidingZoneIDs`/`DragonRidingZoneCheck`
uses `GetInstanceInfo()`'s instance ID: 2444 (Dragon Isles), 2454 (Zaralek Cavern),
2548 (Emerald Dream), 2549 (Amirdrassil), and 2516 (Nokhud Offensive). Race aura
369968 selects the full range elsewhere. The client follows upstream's
`C_Secrets.ShouldSpellCooldownBeSecret` guard before looking up that aura.
These are maintained addon measurements and region exceptions, which may need
updating if Blizzard changes the flight rules. Tests cover each exception,
reduced regions, races, protected aura lookup, boost overflow and flight lifecycle.
