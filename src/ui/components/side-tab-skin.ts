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
	const atlasClient = C_Texture as unknown as {
		GetAtlasInfo(
			this: void,
			atlas: string,
		): {
			leftTexCoord: number;
			rightTexCoord: number;
			topTexCoord: number;
			bottomTexCoord: number;
		};
	};
	const draw = (texture: WowTexture, atlas: string, visible: boolean) => {
		texture.ClearAllPoints();
		if (!visible) {
			texture.SetTexture(undefined);
			return;
		}
		texture.SetAtlas(atlas, true);
		texture.SetPoint("CENTER", frame, "CENTER", 0, 0);
		if (mirrored) {
			const info = atlasClient.GetAtlasInfo(atlas);
			texture.SetTexCoord(
				info.rightTexCoord,
				info.leftTexCoord,
				info.topTexCoord,
				info.bottomTexCoord,
			);
		}
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
