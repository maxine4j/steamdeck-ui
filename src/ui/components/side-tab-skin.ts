import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

/** LargeSideTabButtonTemplate in Blizzard_SharedXML/SharedUIPanelTemplates.xml. */
export function applySideTabSkin(
	pool: IFramePoolManager,
	frame: WowFrame,
	selected: boolean,
	mirrored: boolean,
	hovered: boolean,
): void {
	const draw = (texture: WowTexture, atlas: string, visible: boolean) => {
		texture.ClearAllPoints();
		if (!visible) {
			texture.SetTexture(undefined);
			return;
		}
		// Atlas UVs are local to the atlas region. Match Blizzard's NineSlice.lua:
		// set the normalized flip before applying the atlas, including on reuse.
		texture.SetTexCoord(mirrored ? 1 : 0, mirrored ? 0 : 1, 0, 1);
		texture.SetAtlas(atlas, true);
		texture.SetPoint("CENTER", frame, "CENTER", 0, 0);
	};
	draw(pool.getBackground(frame), "common-sidetab", true);
	draw(
		pool.getDecoration(frame, "side-tab-selected"),
		"common-sidetab-selected",
		selected,
	);
	draw(
		pool.getDecoration(frame, "side-tab-hover"),
		"common-sidetab-hover",
		hovered,
	);
}
