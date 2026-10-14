import { afterEach, expect, it, vi } from "vitest";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { SpellbookPanel } from "./spellbook-panel";

afterEach(() => vi.restoreAllMocks());
it("renders two-column named spell tiles, binds with Y, excludes passive casting, and reuses controls", () => {
	for (const method of [
		"setParent",
		"inset",
		"setWindowBackground",
		"setLabel",
		"show",
		"hide",
		"layout",
		"setIcon",
		"setTooltip",
		"setSpell",
		"setScrollContent",
		"clampScroll",
		"setButtonBackground",
		"setAtlasBackground",
		"setBackgroundOpacity",
		"setIconOutline",
		"setFocused",
		"onClick",
		"revealVerticalRange",
		"destroy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	const groups = [
		{
			id: "class",
			name: "Class",
			spells: [1, 2, 3].map((id) => ({
				id,
				name: `Spell ${id}`,
				icon: id,
				passive: id === 2,
				bookIndex: id,
			})),
		},
	];
	const client = {
		read: vi.fn(() => groups),
		canModify: () => true,
		bind: vi.fn(),
	};
	const prompt = { open: vi.fn(), close: vi.fn() };
	const pool = {} as IFramePoolManager;
	const panel = new SpellbookPanel(pool, client, prompt, vi.fn());
	const parent = new Frame("parent", pool);
	panel.onMount(parent);
	expect(
		panel.getNavGrid().map((row) => row.map((node) => node.navId)),
	).toEqual([["spell-1", "spell-2"], ["spell-3"]]);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"name",
		"Spell 1",
		"TOPLEFT",
		56,
		-8,
		12,
		164,
	);
	const node = panel.getNavGrid().at(0)?.at(0);
	expect(Frame.prototype.setButtonBackground).not.toHaveBeenCalled();
	expect(Frame.prototype.setAtlasBackground).toHaveBeenCalledWith(
		"spellbook-item-backplate",
	);
	expect(Frame.prototype.setBackgroundOpacity).toHaveBeenCalledWith(0.12);
	node?.onFocus();
	expect(Frame.prototype.setFocused).toHaveBeenLastCalledWith(true, true);
	expect(vi.mocked(Frame.prototype.setFocused).mock.contexts.at(-1)?.id).toBe(
		"spellbook-grid-icon-0",
	);
	node?.onBlur();
	expect(Frame.prototype.setFocused).toHaveBeenLastCalledWith(false, true);
	expect(vi.mocked(Frame.prototype.setFocused).mock.contexts.at(-1)?.id).toBe(
		"spellbook-grid-icon-0",
	);
	expect(node?.secureActions?.().alternate?.id).toBe("spellbook-grid-icon-0");
	expect(node?.tooltipItem?.()).toEqual({ spell: 1 });
	expect(Frame.prototype.setTooltip).toHaveBeenCalledWith(
		"Spell 1",
		"spell:1",
		false,
	);
	expect(
		vi
			.mocked(Frame.prototype.setTooltip)
			.mock.contexts.map((frame) => frame.id),
	).toEqual([
		"spellbook-grid-icon-0",
		"spellbook-grid-icon-1",
		"spellbook-grid-icon-2",
	]);
	node?.onContext?.();
	expect(prompt.open).toHaveBeenCalledWith(groups.at(0)?.spells.at(0));
	const passive = panel.getNavGrid().at(0)?.at(1);
	expect(passive?.secureActions?.().alternate).toBeUndefined();
	passive?.onContext?.();
	expect(prompt.open).toHaveBeenCalledOnce();
	const count = vi.mocked(Frame.prototype.setSpell).mock.contexts.length;
	panel.onUnmount();
	expect(panel.getNavGrid()).toEqual([]);
	node?.onContext?.();
	expect(prompt.open).toHaveBeenCalledOnce();
	panel.onMount(parent);
	expect(
		vi
			.mocked(Frame.prototype.setSpell)
			.mock.contexts.slice(count)
			.map((frame) => frame.id),
	).toEqual([
		"spellbook-grid-icon-0",
		"spellbook-grid-icon-1",
		"spellbook-grid-icon-2",
	]);
	panel.destroy();
});
