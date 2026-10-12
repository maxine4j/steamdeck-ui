import { expect, it } from "vitest";
import { radialIndex } from "./radial-selection";

it("selects clockwise from the top for every item count up to twelve", () => {
	for (let count = 1; count <= 12; count++) {
		for (let i = 0; i < count; i++) {
			const angle = (i * Math.PI * 2) / count;
			expect(radialIndex(Math.sin(angle), Math.cos(angle), 1, count)).toBe(
				i + 1,
			);
		}
	}
});

it("cancels inside the deadzone or with an empty ring", () => {
	expect(radialIndex(0, 0, 0, 12)).toBeUndefined();
	expect(radialIndex(0.49, 0, 0.49, 12)).toBeUndefined();
	expect(radialIndex(1, 0, 1, 0)).toBeUndefined();
	expect(radialIndex(0.5, 0, 0.5, 4)).toBe(2);
});
