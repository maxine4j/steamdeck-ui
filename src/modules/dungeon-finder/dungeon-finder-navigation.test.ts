import { expect, it, vi } from "vitest";
import type { IDungeonFinderClient } from "../../clients/dungeon-finder-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type { ModalOption } from "../../ui/components/modal";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { DungeonFinderPanel } from "./dungeon-finder-panel";

const { scrollList } = vi.hoisted(() => ({ scrollList: vi.fn() }));

vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		fill = vi.fn();
		inset = vi.fn();
		setWindowBackground = vi.fn();
		setButtonBackground = vi.fn();
		setAtlasBackground = vi.fn();
		setInsetBackground = vi.fn();
		getSize = () => ({ width: 448, height: 600 });
		onSizeChanged = vi.fn();
		setTextureBackground = vi.fn();
		setIcon = vi.fn();
		setIconRing = vi.fn();
		setCloseButtonBackground = vi.fn();
		setFocused = vi.fn();
		setLabel = vi.fn();
		setLabelWordWrap = vi.fn();
		labelHeight = () => 14;
		setParent = vi.fn();
		layout = vi.fn();
		setColor = vi.fn();
		setBorder = vi.fn();
		setOpacity = vi.fn();
		setTooltip = vi.fn();
		clearTooltip = vi.fn();
		showTooltip = vi.fn();
		hideTooltip = vi.fn();
		setAnimatedAtlas = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		resetScroll = vi.fn();
		revealVerticalRange = vi.fn();
		scrollToEdge = vi.fn();
		onClick = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		navigationNode(navId: string, onInteract: () => void) {
			return { navId, onInteract, onFocus: vi.fn(), onBlur: vi.fn() };
		}
	},
}));

vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		private rows: import("../../ui/components/scroll-list").ListRow[] = [];
		constructor(
			_id: string,
			_pool: unknown,
			_title: string,
			_close: unknown,
			private readonly options: {
				onChanged?: (complete: boolean) => void;
			},
		) {
			scrollList(options);
		}
		mount = vi.fn();
		unmount = vi.fn();
		setTitle = vi.fn();
		resetScroll = vi.fn();
		setWidth = vi.fn();
		setRows = (rows: import("../../ui/components/scroll-list").ListRow[]) => {
			this.rows = rows;
			this.options.onChanged?.(true);
		};
		getNavGrid() {
			return this.rows
				.filter((row) => !row.heading && row.enabled !== false)
				.map((row) => [
					{
						navId: row.id,
						onFocus: vi.fn(),
						onBlur: vi.fn(),
						onInteract: row.secondary?.onlyAction
							? row.secondary.activate
							: row.activate,
					},
				]);
		}
	},
}));

it.each(["random", "specific", "follower", "pvp"] as const)(
	"keeps focus on the pressed %s queue button throughout deferred refreshes",
	(queue) => {
		const callbacks: (() => void)[] = [];
		const flush = (removed = false) => {
			while (callbacks.length) {
				callbacks.shift()?.();
				if (removed && queue === "pvp")
					expect(
						panel
							.getNavGrid()
							.flat()
							.map((node) => node.navId),
					).toContain(nav.focusedId);
				else expect(nav.focusedId).toBe(action);
			}
		};
		let queued = false;
		const selected = queue === "random" || queue === "pvp" ? 3 : queue;
		const client: IDungeonFinderClient = {
			getRaids: () => [],
			canQueueRaid: () => true,
			joinRaid: vi.fn(),
			leaveRaid: vi.fn(),
			getDungeonLists: () => [
				{ id: "specific", label: "Specific Dungeons" },
				{ id: "follower", label: "Follower Dungeon" },
			],
			getDungeons: () => [
				{ id: 1, name: "Normal", section: "normal", available: true },
				{ id: 3, name: "Event", section: "special", available: true },
			],
			getDungeonChoices: () =>
				Array.from({ length: 12 }, (_, id) => ({
					id,
					name: `Dungeon ${id}`,
					available: true,
					checked: true,
					difficulty: "normal" as const,
				})),
			getAvailableRoles: () => ({
				tank: true,
				healer: true,
				damage: true,
				leader: true,
			}),
			getRoles: () => ({
				tank: false,
				healer: false,
				damage: true,
				leader: false,
			}),
			getSelected: () => selected,
			isQueued: () => queued,
			select: vi.fn(),
			selectList: vi.fn(),
			toggleDungeon: vi.fn(),
			toggleRole: vi.fn(),
			join: () => {
				queued = true;
			},
			leave: () => {
				queued = false;
			},
		};
		const pool = {} as IFramePoolManager;
		const events = createTestEventBus();
		const nav = new NavigationManager(events);
		const modal = {
			open: (_title: string, options: readonly ModalOption[]) => {
				nav.pushModal(
					"confirm",
					options.map((option) => [
						{
							navId: `confirm-${option.id}`,
							onFocus: vi.fn(),
							onBlur: vi.fn(),
							onInteract: option.select,
						},
					]),
					() => modal.close(),
				);
			},
			close: () => nav.popModal("confirm"),
		};
		const panel = new DungeonFinderPanel(
			pool,
			client,
			vi.fn(),
			{
				nextFrame: (callback) => {
					callbacks.push(callback);
					return vi.fn();
				},
			},
			modal,
			{
				getActivities: () =>
					[
						"RandomBGButton",
						"RandomEpicBGButton",
						"Arena1Button",
						"BrawlButton",
					].map((id) => ({
						id,
						section: "quick" as const,
						name: id,
						detail: "150 Honor",
						description: "Native description",
						available: true,
					})),
				getQueues: () =>
					queued
						? [{ id: 1, name: "Random Battleground", canLeave: true }]
						: [],
				join: () => {
					queued = true;
				},
				leave: () => {
					queued = false;
				},
				getRoles: () => ({
					tank: false,
					healer: false,
					damage: true,
					leader: false,
				}),
				getAvailableRoles: () => ({
					tank: true,
					healer: true,
					damage: true,
					leader: false,
				}),
				toggleRole: vi.fn(),
			},
		);
		const focus = (id: string) => {
			expect(
				panel
					.getNavGrid()
					.flat()
					.map((node) => node.navId),
			).toContain(id);
			for (let steps = 0; steps < 30 && nav.focusedId !== id; steps++)
				nav.moveDown();
			expect(nav.focusedId).toBe(id);
		};
		panel.onMount(new Frame("parent", pool));
		panel.setNavigationChanged((focusId) => nav.refreshGrid(panel.id, focusId));
		nav.registerGrid(panel.id, () => panel.getNavGrid());
		nav.setActiveGrid(panel.id);
		while (callbacks.length) callbacks.shift()?.();
		expect(nav.focusedId).toBe("page-dungeons");
		if (queue === "pvp") {
			nav.refreshGrid(panel.id, "page-pvp");
			expect(nav.focusedId).toBe("page-pvp");
		} else {
			nav.moveUp();
			expect(nav.focusedId).toBe("role-tank");
			nav.moveDown();
			expect(nav.focusedId).toBe("page-dungeons");
		}
		nav.interact();
		while (callbacks.length) callbacks.shift()?.();
		if (queue !== "random" && queue !== "pvp") {
			focus(`list-${queue}`);
			nav.interact();
			while (callbacks.length) callbacks.shift()?.();
		}
		let action =
			queue === "pvp"
				? "pvp-RandomBGButton"
				: queue === "random"
					? "dungeon-3"
					: "queue-action";
		focus(action);
		nav.interact();
		flush();
		expect(queued).toBe(true);
		if (queue === "pvp") {
			action = "pvp-queue-1";
			focus(action);
		} else
			expect(
				panel
					.getNavGrid()
					.flat()
					.map((node) => node.navId),
			).toEqual(["dungeon-back", action]);
		nav.interact();
		expect(nav.focusedId).toBe("confirm-cancel");
		expect(queued).toBe(true);
		events.emit("NAV_CANCEL");
		expect(nav.focusedId).toBe(action);
		expect(queued).toBe(true);
		nav.interact();
		expect(nav.focusedId).toBe("confirm-cancel");
		nav.moveDown();
		nav.interact();
		// The separate active-queue row disappears after departure.
		flush(true);
		expect(queued).toBe(false);
	},
);
