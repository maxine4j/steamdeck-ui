# SteamDeck UI

SteamDeck UI is a controller-first interface for Retail World of Warcraft, built for Steam Deck.

Written in TypeScript and compiled to Lua with TypeScriptToLua.

## Development

Requires Node.js 24 and Yarn 4.6.0.

Install dependencies and build the addon:

```sh
yarn install
yarn build
```

Run `yarn dev` to recompile Lua as you edit. Run `yarn build` again to refresh the complete addon in `dist/`.

Generate updated WoW API declarations with `yarn setup` when needed.

## Installation guide

1. Build the addon with `yarn build`.
2. Create a `SteamDeckUI-dev` folder inside your Retail WoW installation's `_retail_/Interface/AddOns/` directory.
3. Copy the **contents** of `dist/` into that folder. `SteamDeckUI-dev.toc` should sit directly inside `Interface/AddOns/SteamDeckUI-dev/`.
4. Enable **SteamDeckUI-dev** in the character selection screen's AddOns menu, then log in. Use `/reload` after copying an updated build while logged in.

Use a Steam Input layout that sends native gamepad inputs.

For a release build, run `yarn build:release` and copy the contents of `dist/` into `Interface/AddOns/SteamDeckUI/` instead.

## Testing

```sh
yarn test       # Run unit tests
yarn typecheck  # Check TypeScript types
yarn lint       # Check formatting and lint rules
yarn build     # Compile and package the addon
```

Use `yarn test:watch` to rerun tests as you edit. Test controller input and UI behaviour in WoW after installing the addon.

## Lua error history

Open `/sdui debug` and select **Errors**. The list runs oldest to newest; the red divider marks errors captured since the previous visit. Select an error to view its complete message and stack trace, or select the details for copying. Returning from details preserves the list's viewed boundary; reopening the Errors tab loads a fresh snapshot and saves a new viewed timestamp.

`SteamDeckUIErrors` stores the latest 100 occurrences (including repeated errors), with an ID, Unix timestamp, message and stack trace. Older occurrences are discarded. Capture starts when SteamDeckUI loads; errors from before its handler was installed cannot be recovered.

WoW writes SavedVariables on `/reload` or normal logout. The file is `_retail_/WTF/Account/<account>/SavedVariables/SteamDeckUI-dev.lua` for development installs, or `SteamDeckUI.lua` for release installs. Both the error history and regular configuration live in this addon file. Changes are in memory until WoW flushes them; a crash may lose recent errors.

## License

See [LICENSE](LICENSE). Third-party asset credits are listed in [assets/README.md](assets/README.md).
