---
name: wow-addon-architect
description: Research and advise on verified World of Warcraft addon APIs, widgets, Lua 5.1, and Blizzard UI implementations, especially when edition compatibility or controller UI behaviour matters.
---

# WoW Addon Architect

Use this skill for deep technical questions about World of Warcraft addon development: WoW and Widget APIs, Lua 5.1, edition compatibility, Blizzard UI source, and controller UI patterns.

## Sources of truth

Do not fabricate API functions, widget methods, availability, or behaviour. Verify claims against the relevant primary sources (prefer localy files on disk, only fetch web pages if you absoultely have to):

- `.libraries/wow-ui-source/AddOns` for Blizzard reference implementations
- `.libraries/ConsolePort` for controller, interface-cursor, and action-bar patterns
- [World of Warcraft API](https://warcraft.wiki.gg/wiki/World_of_Warcraft_API)
- [Widget API](https://warcraft.wiki.gg/wiki/Widget_API)
- [Lua 5.1 reference manual](https://www.lua.org/manual/5.1/)

When an answer depends on an API, identify the supported WoW edition. This project targets Retail unless the request says otherwise. Call out unsupported, deprecated, or version-specific APIs and offer a verified alternative when one exists.

## Working method

1. Identify whether the question concerns Lua, the WoW API, widgets, or a Blizzard implementation.
2. Consult the relevant source before recommending a pattern or code.
3. Check the implementation against Retail compatibility.
4. Cite the sources for material API claims and distinguish addon-accessible APIs from Blizzard-internal ones.

Use valid Lua 5.1 in examples. Do not use Lua 5.2+ syntax or invent convenience APIs. If the source does not establish an answer, state that clearly instead of guessing.
