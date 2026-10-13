import { beforeEach, expect, it, vi } from "vitest";
import type { MapQuest } from "../../clients/map-client";
import { Frame } from "../../ui/components/frame";
import type { ModalOption } from "../../ui/components/modal";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
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
		}
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			state.frames.set(id, this);
		}
		layout = vi.fn();
		hide = vi.fn();
		show = vi.fn();
		fill = vi.fn();
		inset = vi.fn();
		setParent = vi.fn();
		setWindowBackground = vi.fn();
		setLabel = vi.fn();
		setButtonBackground = vi.fn();
		onClick = vi.fn();
		onSizeChanged = vi.fn();
		destroy = vi.fn();
		getSize = () => ({ width: 1200, height: 720 });
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
it("updates the native viewport when the fullscreen container changes size", () => {
	const { client } = setup();
	const resize = state.frames
		.get("map-frame")
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
	const cursor = panel.getNavGrid().at(0)?.at(0);
	expect(cursor?.navId).toBe("map-cursor");
	cursor?.onFocus();
	expect(client.setCursorActive).toHaveBeenLastCalledWith(true);
	cursor?.onMove?.("left");
	expect(client.moveCursor).toHaveBeenCalledWith("left");
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
	expect(changed).toHaveBeenLastCalledWith("map-details-down");
	panel.onPanelCycle(-1);
	expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("map-cursor");
	expect(
		state.frames.get("map-quests")?.setLabel.mock.lastCall?.at(1),
	).toContain("LB/RB: Quests");
	panel.onPanelCycle(1);
	expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("map-details-down");
	panel.onUnmount();
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	expect(panel.getNavGrid().at(0)?.at(0)?.navId).toBe("map-header-1");
});
it("puts Blizzard's unified quest hierarchy on the right without custom tabs or red rows", () => {
	const { panel, client, changed } = setup();
	expect(client.mount).toHaveBeenCalled();
	expect(state.frames.get("map-quests")?.layout).toHaveBeenCalledWith(
		420,
		720,
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
	).toContain("map-details-down");
	panel.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(client.scrollDetails).toHaveBeenCalledWith(1);
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
