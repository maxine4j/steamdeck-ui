# SteamDeck UI

Our mission is to make Retail World of Warcraft comfortable to play on Steam Deck with a controller-first interface.

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

## License

See [LICENSE](LICENSE). Third-party asset credits are listed in [assets/README.md](assets/README.md).
