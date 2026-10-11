import { expect, it, vi } from "vitest";
import type { IMountsClient } from "../../clients/mounts-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { MountsPanel } from "./mounts-panel";

const { frames } = vi.hoisted(() => ({
	frames: new Map<
		string,
		{
			layout: ReturnType<typeof vi.fn>;
			setIcon: ReturnType<typeof vi.fn>;
			setLabel: ReturnType<typeof vi.fn>;
			setSpell: ReturnType<typeof vi.fn>;
			click: ReturnType<typeof vi.fn>;
			destroy: ReturnType<typeof vi.fn>;
			onClick: ReturnType<typeof vi.fn>;
			configureInput: ReturnType<typeof vi.fn>;
			inset: ReturnType<typeof vi.fn>;
		}
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			frames.set(id, this);
		}
		layout = vi.fn();
		setIcon = vi.fn();
		setLabel = vi.fn();
		setSpell = vi.fn();
		click = vi.fn();
		destroy = vi.fn();
		onReceiveDrag = vi.fn();
		onClick = vi.fn();
		configureInput = vi.fn();
		inset = vi.fn();
		setParent = vi.fn();
		fill = vi.fn();
		setBlackBackground = vi.fn();
		setColor = vi.fn();
		setTooltip = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		focusInput = vi.fn();
	},
}));

it("renders icons, the unfiltered counter and footer, routes search/favourites and reuses controls", () => {
	const client: IMountsClient = {
		getMounts: () => [
			{
				id: 42,
				index: 1,
				name: "Horse",
				spell: 123,
				icon: 456,
				collected: true,
				usable: true,
				favourite: true,
			},
		],
		getCount: () => ({ collected: 10, total: 50 }),
		search: vi.fn(),
		getFilters: () => [
			{ id: "collection:1", label: "Collected", checked: true },
		],
		toggleFilter: vi.fn(),
		toggleFavourite: vi.fn(),
		getEquipment: () => ({ icon: 789, label: "Equipment", link: "item:1" }),
		applyEquipment: vi.fn(),
		getUtilitySpells: () => ({ favourite: 150544, flight: 460002 }),
	};
	const pool = {} as IFramePoolManager;
	const panel = new MountsPanel(pool, client, vi.fn());
	const parent = new Frame("parent", pool);
	panel.onMount(parent);
	expect(frames.get("mounts-root")?.setLabel).toHaveBeenCalledWith(
		"count",
		"10 / 50",
		"TOPLEFT",
		16,
		-44,
		14,
	);
	expect(frames.get("mounts-icon-0")?.setIcon).toHaveBeenCalledWith(456);
	expect(frames.get("mounts-row-0")?.setLabel.mock.calls.at(0)?.at(1)).toBe(
		"Horse",
	);
	expect(frames.get("mounts-row-0")?.setSpell).toHaveBeenCalledWith(123);
	expect(frames.get("mounts-scroll")?.inset).toHaveBeenCalledWith(
		expect.anything(),
		12,
		112,
		12,
		116,
	);
	expect(frames.get("mounts-equipment")?.setIcon).toHaveBeenCalledWith(789);
	expect(frames.get("mounts-random")?.setSpell).toHaveBeenCalledWith(150544);
	expect(frames.get("mounts-flight")?.setSpell).toHaveBeenCalledWith(460002);
	const count = frames.size;
	const search = frames
		.get("mounts-search")
		?.configureInput.mock.calls.at(0)
		?.at(0) as (text: string) => void;
	search("horse");
	expect(client.search).toHaveBeenCalledWith("horse");
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-42-favourite")
		?.onInteract();
	expect(client.toggleFavourite).toHaveBeenCalledWith(42);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mounts-equipment")
		?.onInteract();
	expect(frames.get("mounts-equipment")?.click).toHaveBeenCalledOnce();
	const equipmentClick = frames
		.get("mounts-equipment")
		?.onClick.mock.calls.at(0)
		?.at(0) as () => void;
	equipmentClick();
	expect(client.applyEquipment).toHaveBeenCalledOnce();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mounts-filters")
		?.onInteract();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "collection:1")
		?.onInteract();
	expect(client.toggleFilter).toHaveBeenCalledWith("collection:1");
	panel.onUnmount();
	expect(panel.getNavGrid()).toEqual([]);
	search("hidden");
	expect(client.search).toHaveBeenCalledTimes(1);
	panel.onMount(parent);
	panel.refresh();
	// The dropdown's first opening acquires its controls once.
	expect(frames.size).toBeGreaterThan(count);
	const afterDropdown = frames.size;
	panel.onUnmount();
	panel.onMount(parent);
	expect(frames.size).toBe(afterDropdown);
	panel.destroy();
	expect(frames.get("mounts-search")?.destroy).toHaveBeenCalledOnce();
});
