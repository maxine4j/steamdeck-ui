import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])(
	"renders Blizzard side-tab artwork and clears selection and hover on reuse (mirrored: %s)",
	(mirrored) => {
		vi.stubGlobal("C_Texture", {
			GetAtlasInfo: () => ({
				leftTexCoord: 0.1,
				rightTexCoord: 0.4,
				topTexCoord: 0.2,
				bottomTexCoord: 0.8,
			}),
		});
		const textures: {
			SetAtlas: ReturnType<typeof vi.fn>;
			SetTexture: ReturnType<typeof vi.fn>;
			SetTexCoord: ReturnType<typeof vi.fn>;
			SetPoint: ReturnType<typeof vi.fn>;
			SetWidth: ReturnType<typeof vi.fn>;
			SetHeight: ReturnType<typeof vi.fn>;
		}[] = [];
		const native = {
			Hide: vi.fn(),
			SetParent: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetSize: vi.fn(),
			SetScript: vi.fn(),
			CreateTexture: () => {
				const texture = {
					SetAtlas: vi.fn(),
					SetTexture: vi.fn(),
					SetTexCoord: vi.fn(),
					SetPoint: vi.fn(),
					SetAllPoints: vi.fn(),
					ClearAllPoints: vi.fn(),
					SetColorTexture: vi.fn(),
					SetWidth: vi.fn(),
					SetHeight: vi.fn(),
				};
				textures.push(texture);
				return texture;
			},
		} as unknown as WowFrame;
		const pool = new FramePoolManager({ createFrame: () => native });
		const tab = new Frame("tab", pool);
		tab.setSideTabBackground(true, mirrored, true);
		expect(textures).toHaveLength(3);
		for (const [index, atlas] of [
			[0, "common-sidetab"],
			[1, "common-sidetab-selected"],
			[2, "common-sidetab-hover"],
		] as const) {
			const texture = textures.at(index);
			expect(texture?.SetAtlas).toHaveBeenLastCalledWith(atlas, true);
			expect(texture?.SetPoint).toHaveBeenLastCalledWith(
				"CENTER",
				native,
				"CENTER",
				0,
				0,
			);
			if (mirrored) {
				expect(texture?.SetTexCoord).toHaveBeenLastCalledWith(
					0.4,
					0.1,
					0.2,
					0.8,
				);
			} else expect(texture?.SetTexCoord).not.toHaveBeenCalled();
		}
		tab.setSideTabBackground(false, mirrored);
		expect(textures.at(1)?.SetTexture).toHaveBeenLastCalledWith(undefined);
		expect(textures.at(2)?.SetTexture).toHaveBeenLastCalledWith(undefined);
		tab.setIcon(133633);
		tab.setIconSize(32, 32, mirrored ? 2 : -2);
		expect(textures.at(0)?.SetWidth).toHaveBeenLastCalledWith(32);
		expect(textures.at(0)?.SetHeight).toHaveBeenLastCalledWith(32);
		expect(textures.at(0)?.SetPoint).toHaveBeenLastCalledWith(
			"CENTER",
			native,
			"CENTER",
			mirrored ? 2 : -2,
			0,
		);
		expect(textures.at(0)?.SetTexCoord).toHaveBeenLastCalledWith(
			0.07,
			0.93,
			0.07,
			0.93,
		);
		tab.destroy();
		const reused = new Frame("reused", pool);
		reused.setSideTabBackground(false, !mirrored);
		expect(textures).toHaveLength(3);
		expect(textures.at(1)?.SetTexture).toHaveBeenLastCalledWith(undefined);
		expect(textures.at(2)?.SetTexture).toHaveBeenLastCalledWith(undefined);
	},
);
