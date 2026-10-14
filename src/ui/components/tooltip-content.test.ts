import { expect, it, vi } from "vitest";
import { setTooltipContent } from "./tooltip-content";

it.each([true, false])(
	"renders pet journal details with source and collection status for collected=%s",
	(collected) => {
		vi.stubGlobal("NOT_COLLECTED", "Not collected");
		const frame = {
			SetText: vi.fn(),
			SetHyperlink: vi.fn(),
			SetToyByItemID: vi.fn(),
			SetMountBySpellID: vi.fn(),
			SetCompanionPet: vi.fn(),
			AddLine: vi.fn(),
		};
		setTooltipContent(frame, {
			pet: {
				id: collected ? "Pet-1" : "species-39",
				name: "Cat",
				collected,
				source: "Vendor: Cat Merchant",
				description: "A friendly cat.",
			},
		});
		if (collected) expect(frame.SetCompanionPet).toHaveBeenCalledWith("Pet-1");
		else {
			expect(frame.SetCompanionPet).not.toHaveBeenCalled();
			expect(frame.SetText).toHaveBeenCalledWith("Cat");
			expect(frame.AddLine).toHaveBeenCalledWith(
				"A friendly cat.",
				1,
				1,
				1,
				true,
			);
			expect(frame.AddLine).toHaveBeenCalledWith(
				"Not collected",
				1,
				0.82,
				0,
				true,
			);
		}
		expect(frame.AddLine).toHaveBeenCalledWith(
			"Vendor: Cat Merchant",
			1,
			1,
			1,
			true,
		);
		expect(frame.SetHyperlink).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	},
);

it("renders plain text details for controller focus and hover", () => {
	const frame = {
		SetText: vi.fn(),
		SetHyperlink: vi.fn(),
		SetToyByItemID: vi.fn(),
		SetMountBySpellID: vi.fn(),
	};
	setTooltipContent(frame, { text: "Explorer\nExplore the world" });
	expect(frame.SetText).toHaveBeenCalledWith(
		"Explorer\nExplore the world",
		1,
		1,
		1,
		1,
		true,
	);
	expect(frame.SetHyperlink).not.toHaveBeenCalled();
});
