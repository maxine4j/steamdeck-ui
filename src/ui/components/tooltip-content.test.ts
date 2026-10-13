import { expect, it, vi } from "vitest";
import { setTooltipContent } from "./tooltip-content";

it("renders plain text details for controller focus and hover", () => {
	const frame = {
		SetText: vi.fn(),
		SetHyperlink: vi.fn(),
		SetToyByItemID: vi.fn(),
		SetMountBySpellID: vi.fn(),
	};
	setTooltipContent(frame, { text: "Explorer\nExplore the world" });
	expect(frame.SetText).toHaveBeenCalledWith("Explorer\nExplore the world");
	expect(frame.SetHyperlink).not.toHaveBeenCalled();
});
