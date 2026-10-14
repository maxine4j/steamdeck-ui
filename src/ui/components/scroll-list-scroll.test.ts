import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { ScrollList } from "./scroll-list";

it("allows external controls to scroll an informational list without activating a row", () => {
	const scroll = vi
		.spyOn(Frame.prototype, "scrollBy")
		.mockReturnValue({ offset: 80, range: 200 });
	const list = new ScrollList(
		"information",
		{} as IFramePoolManager,
		"",
		() => {},
	);
	list.scrollBy(80);
	expect(scroll).toHaveBeenCalledWith(80);
	scroll.mockRestore();
});
