import { afterEach, expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Dropdown } from "./dropdown";
import { Frame } from "./frame";
import { SearchFilters } from "./search-filters";

afterEach(() => vi.restoreAllMocks());

it("provides native search and filter controls with explicit controller text focus and lifecycle cleanup", () => {
	for (const method of [
		"setParent",
		"layout",
		"configureInput",
		"show",
		"blurInput",
		"focusInput",
		"setFocused",
		"destroy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	vi.spyOn(Dropdown.prototype, "mount").mockImplementation(() => {});
	const hide = vi
		.spyOn(Dropdown.prototype, "hide")
		.mockImplementation(() => {});
	vi.spyOn(Dropdown.prototype, "destroy").mockImplementation(() => {});
	const pool = {} as IFramePoolManager;
	const changed = vi.fn();
	const controls = new SearchFilters("toys", pool, changed);
	controls.mount(new Frame("parent", pool));
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		300,
		20,
		"TOPLEFT",
		expect.any(Frame),
		16,
		-66,
	);
	const node = controls
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "toys-search");
	node?.onFocus();
	expect(Frame.prototype.focusInput).not.toHaveBeenCalled();
	node?.onInteract();
	expect(Frame.prototype.focusInput).toHaveBeenCalledOnce();
	vi.mocked(Frame.prototype.configureInput).mock.lastCall?.at(0)?.("dragon");
	expect(changed).toHaveBeenCalledWith("dragon");
	node?.onBlur();
	expect(Frame.prototype.blurInput).toHaveBeenCalled();
	controls.hide();
	node?.onInteract();
	expect(Frame.prototype.focusInput).toHaveBeenCalledOnce();
	expect(hide).toHaveBeenCalledOnce();
	controls.destroy();
	expect(Frame.prototype.destroy).toHaveBeenCalled();
});
