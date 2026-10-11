import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { TitlesPanel } from "./titles-panel";

const { construct } = vi.hoisted(() => ({ construct: vi.fn() }));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(...args: unknown[]) {
			construct(...args);
		}
	},
}));

it("gives the titles list 30px padding", () => {
	const pool = {} as IFramePoolManager;
	const close = vi.fn();
	new TitlesPanel(pool, { getTitles: () => [], select: vi.fn() }, close);
	expect(construct).toHaveBeenCalledWith("titles", pool, "Titles", close, {
		padding: 30,
	});
});
