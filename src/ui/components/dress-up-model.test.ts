import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("loads the player's active transmog, supports persistent try-ons and undressing, and resets pooled models", () => {
	const native = {
		Hide: vi.fn(),
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		SetSize: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetUnit: vi.fn(),
		SetPortraitZoom: vi.fn(),
		SetCamDistanceScale: vi.fn(),
		SetFacing: vi.fn(),
		SetUseTransmogChoices: vi.fn(),
		SetKeepModelOnHide: vi.fn(),
		TryOn: vi.fn(),
		Undress: vi.fn(),
		ClearModel: vi.fn(),
	};
	const texture = {
		ClearAllPoints: vi.fn(),
		SetAllPoints: vi.fn(),
		SetTexture: vi.fn(),
		SetTexCoord: vi.fn(),
		SetColorTexture: vi.fn(),
	};
	const pool = new FramePoolManager({
		createFrame: () =>
			({ ...native, CreateTexture: () => texture }) as unknown as WowFrame,
	});
	const model = new Frame("preview", pool, "DressUpModel");
	model.setModelUnit("player");
	expect(native.SetUseTransmogChoices).toHaveBeenCalledWith(true);
	expect(native.SetKeepModelOnHide).toHaveBeenCalledWith(true);
	expect(
		native.SetUseTransmogChoices.mock.invocationCallOrder.at(0),
	).toBeLessThan(native.SetUnit.mock.invocationCallOrder.at(0) ?? 0);
	model.tryOnModel(42, "SecondaryHandSlot");
	expect(native.TryOn).toHaveBeenCalledWith(42, "SecondaryHandSlot");
	expect(native.SetUnit).toHaveBeenCalledOnce();
	model.undressModel();
	expect(native.Undress).toHaveBeenCalledOnce();
	model.destroy();
	expect(native.ClearModel).toHaveBeenCalledOnce();
	expect(native.SetKeepModelOnHide).toHaveBeenLastCalledWith(false);
});
