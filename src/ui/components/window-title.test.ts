import { expect, it, vi } from "vitest";
import type { Frame } from "./frame";
import { setWindowTitle } from "./window-title";

it("places window titles in the center of the metal header at the standard font size", () => {
	const frame = { setLabel: vi.fn() } as unknown as Frame;
	setWindowTitle(frame, "Reputation");
	expect(frame.setLabel).toHaveBeenCalledExactlyOnceWith(
		"window-title",
		"Reputation",
		"TOP",
		0,
		-6,
		12,
	);
});
