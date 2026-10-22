import { expect, it, vi } from "vitest";
import { PreyMapPresentation } from "./prey-map-presentation";
import type { PreyMapPin } from "./wow-prey-globals";

it("uses distinct skull artwork and a separate bang only for needed targets", () => {
	const markers = { sync: vi.fn(), release: vi.fn() };
	const presentation = new PreyMapPresentation(markers);
	const pin = { Icon: {}, IconHighlight: {} } as PreyMapPin;
	presentation.sync(
		[1, 2, 3].map((difficulty) => ({
			pin,
			target: { difficulty: difficulty as 1 | 2 | 3, needed: difficulty === 3 },
		})),
	);
	expect(markers.sync).toHaveBeenCalledWith([
		{
			owner: pin,
			replace: [pin.Icon, pin.IconHighlight],
			atlas: "ui-hud-minimap-guildbanner-normal-large",
			size: 38,
			badge: undefined,
		},
		{
			owner: pin,
			replace: [pin.Icon, pin.IconHighlight],
			atlas: "ui-hud-minimap-guildbanner-heroic-large",
			size: 38,
			badge: undefined,
		},
		{
			owner: pin,
			replace: [pin.Icon, pin.IconHighlight],
			atlas: "ui-hud-minimap-guildbanner-mythic-large",
			size: 38,
			badge: { atlas: "QuestNormal", size: 16, x: 22 },
		},
	]);
	presentation.sync([]);
	expect(markers.sync).toHaveBeenLastCalledWith([]);
	presentation.release();
	expect(markers.release).toHaveBeenCalledOnce();
});
