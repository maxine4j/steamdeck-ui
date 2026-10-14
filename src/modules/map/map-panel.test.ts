import { beforeEach, expect, it, vi } from "vitest";
import type { MapQuest } from "../../clients/map-client";
import { Frame } from "../../ui/components/frame";
import type { ModalOption } from "../../ui/components/modal";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";
import { MapPanel } from "./map-panel";

const state = vi.hoisted(() => ({
	rows: [] as ListRow[],
	frames: new Map<
		string,
		{
			layout: ReturnType<typeof vi.fn>;
			hide: ReturnType<typeof vi.fn>;
			onSizeChanged: ReturnType<typeof vi.fn>;
			setLabel: ReturnType<typeof vi.fn>;
			setFocusBorder: ReturnType<typeof vi.fn>;
			setWindowBackground: ReturnType<typeof vi.fn>;
			getSize: () => { width: number; height: number };
		}
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		private size = { width: 1200, height: 720 };
		constructor(readonly id: string) {
			state.frames.set(id, this);
		}
		layout = vi.fn((width: number, height: number) => {
			this.size = { width, height };
		});
		hide = vi.fn();
		show = vi.fn();
		fill = vi.fn();
		inset = vi.fn();
		setParent = vi.fn();
		setWindowBackground = vi.fn();
		setLabel = vi.fn();
		setFocusBorder = vi.fn();
		setButtonBackground = vi.fn();
		onClick = vi.fn();
		onSizeChanged = vi.fn();
		destroy = vi.fn();
		getSize = () => this.size;
		navigationNode = (navId: string, onInteract: () => void) => ({
			navId,
			onInteract,
			onFocus: vi.fn(),
			onBlur: vi.fn(),
		});
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		setRows = (rows: ListRow[]) => {
			state.rows = rows;
		};
		mount = vi.fn();
		unmount = vi.fn();
		destroy = vi.fn();
		setTitle = vi.fn();
		getNavGrid = () =>
			state.rows
				.filter((row) => !row.heading)
				.map((row) => [
					{
						navId: row.id,
						onFocus: vi.fn(),
						onBlur: vi.fn(),
						onInteract: row.activate,
						onContext: row.context,
					},
				]);
	},
}));
beforeEach(() => {
	state.rows = [];
	state.frames.clear();
});
it("outlines only the active map or quest side and removes it while inactive", () => {
	const { panel } = setup();
	(panel as IPanel).onActiveChanged?.(true);
	expect(
		state.frames.get("map-quests")?.setFocusBorder,
	).toHaveBeenLastCalledWith(true);
	expect(state.frames.get("map-side")?.setFocusBorder).toHaveBeenLastCalledWith(
		false,
	);
	expect(state.frames.get("map-side")?.layout).toHaveBeenCalledWith(
		880,
		880 / 1.5 + 52,
		"TOPLEFT",
		expect.anything(),
	);
	panel.onPanelCycle(1);
	expect(
		state.frames.get("map-quests")?.setFocusBorder,
	).toHaveBeenLastCalledWith(false);
	expect(state.frames.get("map-side")?.setFocusBorder).toHaveBeenLastCalledWith(
		true,
	);
	(panel as IPanel).onActiveChanged?.(false);
	expect(state.frames.get("map-side")?.setFocusBorder).toHaveBeenLastCalledWith(
		false,
	);
	panel.onPanelCycle(-1);
	expect(
		state.frames.get("map-quests")?.setFocusBorder,
	).toHaveBeenLastCalledWith(false);
	(panel as IPanel).onActiveChanged?.(true);
	expect(
		state.frames.get("map-quests")?.setFocusBorder,
	).toHaveBeenLastCalledWith(true);
	panel.onUnmount();
	expect(
		state.frames.get("map-quests")?.setFocusBorder,
	).toHaveBeenLastCalledWith(false);
});

it("centers a fitted window, uses the native title copy and fits quests on resize", () => {
	const { panel, client } = setup();
	expect(
		state.frames.get("map-frame")?.setWindowBackground,
	).toHaveBeenCalledOnce();
	expect(
		state.frames.get("map-side")?.setWindowBackground,
	).not.toHaveBeenCalled();
	expect(
		state.frames.get("map-quests")?.setWindowBackground,
	).not.toHaveBeenCalled();
	expect(state.frames.get("map-frame")?.layout).toHaveBeenCalledWith(
		1200,
		880 / 1.5 + 52,
		"CENTER",
		expect.anything(),
	);
	expect(state.frames.get("map-frame")?.setLabel).toHaveBeenCalledWith(
		"window-title",
		"Map & Quest Log",
		"TOP",
		0,
		-6,
		12,
	);
	client.presentation.mockReturnValue({
		title: "Map & Quest Log",
		height: 500,
	});
	panel.refresh();
	expect(state.frames.get("map-quests")?.layout).toHaveBeenLastCalledWith(
		320,
		500,
		"TOPRIGHT",
		expect.anything(),
	);
	expect(client.resize).toHaveBeenCalledOnce();
});

it("waits for the native category rebuild before refreshing controller focus", () => {
	const { panel, client, changed } = setup();
	let rebuilding = false;
	const original = client.navigation;
	client.navigation = vi.fn(() =>
		rebuilding
			? []
			: [
					...original(),
					{
						node: {
							navId: "map-header-later",
							onFocus: vi.fn(),
							onBlur: vi.fn(),
							onInteract: vi.fn(),
						},
					},
				],
	);
	panel.refresh();
	const category = panel.getNavGrid().at(-1)?.at(0);
	category?.onFocus();
	// Collapse returns before Blizzard has rebuilt the pooled rows.
	rebuilding = true;
	changed.mockClear();
	category?.onInteract();
	expect(changed).not.toHaveBeenCalled();
	rebuilding = false;
	panel.refresh();
	expect(changed).toHaveBeenLastCalledWith("map-header-later");
});

it("keeps focus near a removed quest instead of returning to the first category", () => {
	const { panel, quests, changed } = setup();
	panel.getNavGrid().at(2)?.at(0)?.onFocus();
	quests.splice(1, 1);
	panel.refresh();
	expect(changed).toHaveBeenLastCalledWith("map-quest-1");
});

it("returns to the containing category when a focused quest is hidden by collapse", () => {
	const { panel, client, changed } = setup();
	const original = client.navigation;
	const header = {
		node: {
			navId: "map-header-later",
			onFocus: vi.fn(),
			onBlur: vi.fn(),
			onInteract: vi.fn(),
		},
	};
	client.navigation = () => [
		...original().slice(0, 2),
		header,
		...original().slice(2),
	];
	panel.refresh();
	panel.getNavGrid().at(4)?.at(0)?.onFocus();
	client.navigation = () => [...original().slice(0, 2), header];
	panel.refresh();
	expect(changed).toHaveBeenLastCalledWith("map-header-later");
});

it("retains the intended quest through an intermediate rebuild and automatic fallback focus", () => {
	const { panel, client, changed } = setup();
	const original = client.navigation;
	panel.getNavGrid().at(2)?.at(0)?.onFocus();
	panel.setNavigationChanged((id) => {
		changed(id);
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === id)
			?.onFocus();
	});
	client.navigation = () => original().slice(0, 1);
	panel.refresh();
	client.navigation = original;
	panel.refresh();
	expect(changed).toHaveBeenLastCalledWith("map-quest-2");
});

it("waits for native navigation completion after tracking actions", () => {
	const { panel, client, modal, changed } = setup();
	panel.getNavGrid().at(2)?.at(0)?.onContext?.();
	const options = modal.open.mock.lastCall?.at(1) as ModalOption[];
	changed.mockClear();
	options.find((option) => option.id === "track")?.select();
	expect(client.track).toHaveBeenCalledWith(2);
	expect(changed).not.toHaveBeenCalled();
	options.find((option) => option.id === "super-track")?.select();
	expect(client.superTrack).toHaveBeenCalledWith(2);
	expect(changed).not.toHaveBeenCalled();
});

it("updates the native viewport when the fullscreen container changes size", () => {
	const { client } = setup();
	const resize = state.frames
		.get("parent")
		?.onSizeChanged.mock.lastCall?.at(0) as (() => void) | undefined;
	resize?.();
	expect(client.resize).toHaveBeenCalledOnce();
});
function setup() {
	const quests: MapQuest[] = [
		{
			id: 1,
			title: "Campaign",
			campaign: true,
			zone: "Zone",
			objectives: ["Go there"],
			tracked: false,
			superTracked: false,
			canAbandon: false,
			canShare: false,
		},
		{
			id: 2,
			title: "Daily",
			campaign: false,
			zone: "Zone",
			objectives: ["Do this"],
			tracked: true,
			superTracked: true,
			canAbandon: true,
			canShare: true,
		},
		{
			id: 3,
			title: "Local story",
			campaign: false,
			zone: "Zone",
			objectives: [],
			tracked: false,
			superTracked: false,
			canAbandon: true,
			canShare: false,
		},
	];
	const client = {
		presentation: vi.fn((available: { width: number; height: number }) => ({
			title: "Map & Quest Log",
			height: Math.min(available.height, (available.width - 320) / 1.5 + 52),
		})),
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: () => true,
		close: vi.fn(),
		mount: vi.fn(),
		resize: vi.fn(),
		moveCursor: vi.fn(),
		setCursorActive: vi.fn(),
		clickMap: vi.fn(),
		unmount: vi.fn(),
		read: () => quests,
		navigation: () => [
			{
				node: {
					navId: "map-header-1",
					onFocus: vi.fn(),
					onBlur: vi.fn(),
					onInteract: vi.fn(),
				},
			},
			...quests.map((quest) => ({
				questID: quest.id,
				node: {
					navId: `map-quest-${quest.id}`,
					onFocus: vi.fn(),
					onBlur: vi.fn(),
					onInteract: vi.fn(),
				},
			})),
		],
		focus: vi.fn(),
		showDetails: vi.fn(),
		hideDetails: vi.fn(),
		scrollDetails: vi.fn(),
		track: vi.fn(),
		superTrack: vi.fn(),
		abandon: vi.fn(),
		share: vi.fn(),
	};
	const modal = { open: vi.fn(), close: vi.fn() };
	const close = vi.fn(),
		changed = vi.fn();
	const panel = new MapPanel({} as IFramePoolManager, client, modal, close);
	panel.setNavigationChanged(changed);
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	return { panel, client, modal, close, changed, quests };
}
it("cycles map and quests with bumpers, retaining quest focus and routing map controls", () => {
	const { panel, client, changed } = setup();
	panel.getNavGrid().at(2)?.at(0)?.onFocus();
	panel.onPanelCycle(-1);
	expect(
		state.frames.get("map-quests")?.setLabel.mock.lastCall?.at(1),
	).toContain("xbox_r_x.blp:18:18|t Select / Pin");
	const cursor = panel.getNavGrid().at(0)?.at(0);
	expect(cursor?.navId).toBe("map-cursor");
	cursor?.onFocus();
	expect(client.setCursorActive).toHaveBeenLastCalledWith(true);
	cursor?.onMove?.("left", true);
	expect(client.moveCursor).toHaveBeenCalledWith("left", true);
	cursor?.onAlternate?.();
	cursor?.onContext?.();
	expect(client.clickMap.mock.calls).toEqual([["LeftButton"], ["RightButton"]]);
	panel.refresh();
	expect(changed).toHaveBeenLastCalledWith("map-cursor");
	cursor?.onBlur();
	expect(client.setCursorActive).toHaveBeenLastCalledWith(false);
	panel.onPanelCycle(1);
	expect(changed).toHaveBeenLastCalledWith("map-quest-2");
	panel.onPanelCycle(1);
	expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("map-cursor");
	panel.showDetails(2);
	expect(changed).toHaveBeenLastCalledWith("map-details");
	panel.onPanelCycle(-1);
	expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("map-cursor");
	expect(
		state.frames.get("map-quests")?.setLabel.mock.lastCall?.at(1),
	).toContain(
		"xbox_s_lb.blp:18:18|t/|TInterface\\AddOns\\SteamDeckUI\\assets\\controller\\xbox_s_rb.blp:18:18|t Quests",
	);
	panel.onPanelCycle(1);
	expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("map-details");
	panel.onUnmount();
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("map-header-1");
});
it("puts Blizzard's unified quest hierarchy on the right without custom tabs or red rows", () => {
	const { panel, client, changed } = setup();
	expect(client.mount).toHaveBeenCalled();
	expect(state.frames.get("map-quests")?.layout).toHaveBeenCalledWith(
		320,
		880 / 1.5 + 52,
		"TOPRIGHT",
		expect.anything(),
	);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["map-header-1", "map-quest-1", "map-quest-2", "map-quest-3"]);
	expect(state.frames.has("map-campaign-tab")).toBe(false);
	expect(state.frames.has("map-other-tab")).toBe(false);
	expect(state.rows).toEqual([]);
	panel.getNavGrid().at(3)?.at(0)?.onFocus();
	panel.refresh();
	expect(changed).toHaveBeenLastCalledWith("map-quest-3");
});
it("maps X to focus, A to native details, and B back to the previous list and selected quest", () => {
	const { panel, client, changed, close } = setup();
	const quest = panel.getNavGrid().at(3)?.at(0);
	quest?.onFocus();
	quest?.onAlternate?.();
	expect(client.focus).toHaveBeenCalledWith(3);
	expect(client.showDetails).not.toHaveBeenCalled();
	quest?.onInteract();
	expect(client.showDetails).toHaveBeenCalledWith(3);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["map-details"]);
	const details = panel.getNavGrid().at(0)?.at(0);
	expect(state.frames.has("map-details-down")).toBe(false);
	expect(state.frames.has("map-details-up")).toBe(false);
	details?.onInteract();
	details?.onMove?.("down", false);
	details?.onMove?.("left", true);
	expect(client.scrollDetails).not.toHaveBeenCalled();
	details?.onMove?.("down", true);
	expect(client.scrollDetails).toHaveBeenCalledWith(1);
	details?.onMove?.("up", true);
	expect(client.scrollDetails).toHaveBeenCalledWith(-1);
	panel.onBack();
	expect(client.hideDetails).toHaveBeenCalled();
	expect(changed).toHaveBeenLastCalledWith("map-quest-3");
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["map-header-1", "map-quest-1", "map-quest-2", "map-quest-3"]);
	panel.onBack();
	expect(close).toHaveBeenCalledOnce();
});
it("opens Y options with only available actions and uses confirmation before abandonment", () => {
	const { panel, client, modal } = setup();
	panel.getNavGrid().at(1)?.at(0)?.onContext?.();
	let options = modal.open.mock.lastCall?.at(1) as ModalOption[];
	expect(options.map((option) => option.id)).toEqual([
		"details",
		"track",
		"super-track",
		"focus",
	]);
	panel.getNavGrid().at(2)?.at(0)?.onContext?.();
	options = modal.open.mock.lastCall?.at(1) as ModalOption[];
	expect(options.map((option) => option.id)).toEqual([
		"details",
		"track",
		"super-track",
		"focus",
		"share",
		"abandon",
	]);
	expect(options.find((option) => option.id === "track")?.label).toBe(
		"Untrack quest",
	);
	expect(options.find((option) => option.id === "super-track")?.label).toBe(
		"Stop navigating to quest",
	);
	options.find((option) => option.id === "super-track")?.select();
	expect(client.superTrack).toHaveBeenCalledWith(2);
	options.find((option) => option.id === "track")?.select();
	expect(client.track).toHaveBeenCalledWith(2);
	options.find((option) => option.id === "abandon")?.select();
	expect(client.abandon).not.toHaveBeenCalled();
	const confirm = modal.open.mock.lastCall?.at(1) as ModalOption[];
	confirm.find((option) => option.id === "confirm")?.select();
	expect(client.abandon).toHaveBeenCalledWith(2);
});
it("handles native pin selection, quest removal and closing without retaining stale details", () => {
	const { panel, quests, client } = setup();
	panel.showDetails(2);
	panel.onBack();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["map-header-1", "map-quest-1", "map-quest-2", "map-quest-3"]);
	panel.showDetails(2);
	quests.splice(1, 1);
	panel.refresh();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["map-header-1", "map-quest-1", "map-quest-3"]);
	quests.length = 0;
	panel.refresh();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["map-header-1"]);
	panel.onUnmount();
	expect(client.unmount).toHaveBeenCalledOnce();
	panel.onContainerClosed();
	expect(client.close).toHaveBeenCalledOnce();
});
